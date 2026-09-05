"use client";

/**
 * SDK wallet store — the app-held-key account (RFP-literal route).
 *
 * Holds an embedded throwaway key (Sepolia-first; mainnet lights up once a
 * proving URL is configured), derives the viewing key canonically, and drives
 * every privacy op through lib/sdk.ts — the app generates the key, registers
 * it, runs discovery, and builds proofs itself. No browser wallet involved.
 *
 * ⚠️ Throwaway keys only. The private key lives in localStorage so the demo
 * can persist across reloads — never put real mainnet funds behind it.
 */

import { create } from "zustand";
import { Account, RpcProvider, ec, hash, validateAndParseAddress } from "starknet";
import {
  deriveViewingKey,
  discoverSdkNotes,
  ensureAccountDeployed,
  fetchPublicStrkBalance,
  friendlySdkError,
  generateAndRegisterViewingKey,
  generateThrowaway,
  getPoolFeeStrk,
  isRegistered,
  OZ_CLASS_HASH,
  sdkConfigFor,
  sdkBuildPrivateTransfer,
  sdkSendPrivate,
  sdkShield,
  sdkUnshield,
  waitUntilMature,
  type SdkNetwork,
} from "@/lib/sdk";
import {
  fetchSponsoredFee,
  getPaymasterStatus,
  submitSponsored,
} from "@/lib/paymaster";
import {
  decryptPrivateKey,
  encryptPrivateKey,
  type EncryptedKey,
} from "@/lib/keystore";
import { amountToUnits, feltToAmount } from "@/lib/format";
import { logEvent } from "@/lib/diagnostics";
import { STRK } from "@/lib/chain";

export interface SdkActivity {
  kind: "shield" | "unshield" | "sent";
  amount: number;
  txHash: string;
  ts: number;
}

const encKeyOf = (network: SdkNetwork) => `kairo:sdk:enc:${network}`;
const legacyKeyOf = (network: SdkNetwork) => `kairo:sdk:key:${network}`;
const historyKey = (network: SdkNetwork, addr: string) =>
  `kairo:sdk:history:${network}:${addr.toLowerCase()}`;

function loadCipher(network: SdkNetwork): EncryptedKey | undefined {
  try {
    const raw = localStorage.getItem(encKeyOf(network));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as EncryptedKey;
    if (parsed?.v !== 1 || !parsed.salt || !parsed.iv || !parsed.data) {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

/** Pre-encryption plaintext from older builds — migrated, never written. */
function loadLegacy(network: SdkNetwork): string | undefined {
  try {
    return localStorage.getItem(legacyKeyOf(network)) ?? undefined;
  } catch {
    return undefined;
  }
}

function saveCipher(network: SdkNetwork, payload: EncryptedKey) {
  localStorage.setItem(encKeyOf(network), JSON.stringify(payload));
}

function clearStoredKey(network: SdkNetwork) {
  try {
    localStorage.removeItem(encKeyOf(network));
    localStorage.removeItem(legacyKeyOf(network));
  } catch {
    /* ignore */
  }
}

function loadHistory(network: SdkNetwork, addr: string): SdkActivity[] {
  try {
    return JSON.parse(localStorage.getItem(historyKey(network, addr)) ?? "[]");
  } catch {
    return [];
  }
}

function recordActivity(
  network: SdkNetwork,
  addr: string,
  item: SdkActivity,
): SdkActivity[] {
  const list = [item, ...loadHistory(network, addr)].slice(0, 50);
  try {
    localStorage.setItem(historyKey(network, addr), JSON.stringify(list));
  } catch {
    /* storage unavailable — history stays in-memory for the session */
  }
  return list;
}

function addressFromPrivateKey(privateKey: string): {
  publicKey: string;
  address: string;
} {
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const address = hash.calculateContractAddressFromHash(
    publicKey,
    OZ_CLASS_HASH,
    [publicKey],
    0,
  );
  return { publicKey, address };
}

function accountFor(
  address: string,
  privateKey: string,
  network: SdkNetwork,
): Account {
  const cfg = sdkConfigFor(network);
  return new Account({
    provider: new RpcProvider({ nodeUrl: cfg.rpcUrl }),
    address,
    signer: privateKey,
    cairoVersion: "1",
  });
}

export type SdkStatus = "idle" | "ready" | "error";

interface SdkWalletState {
  network: SdkNetwork;
  status: SdkStatus;
  error?: string;
  busy?: string;
  /** Checksummed embedded address once a key is loaded. */
  address?: string;
  viewingKey?: bigint;
  registered: boolean;
  deployed: boolean;
  shielded?: number;
  publicStrk?: number;
  feeStrk: number;
  history: SdkActivity[];
  account?: Account;
  /** Raw key — memory only while unlocked. NEVER persisted; wiped on lock. */
  privateKey?: string;
  /** True when ciphertext exists but is not decrypted (or no key at all). */
  locked: boolean;
  /** True when any stored key (ciphertext or legacy plaintext) exists. */
  hasStoredKey: boolean;
  /** How SDK sends are submitted: paymaster relay or self-submission. */
  paymaster: "unknown" | "sponsored" | "self-pay";

  setNetwork: (network: SdkNetwork) => void;
  /** Generate a fresh throwaway, encrypt with password, persist ciphertext. */
  generate: (password: string) => Promise<void>;
  /** Import a raw private key (hex), encrypt with password, persist. */
  importKey: (privateKey: string, password: string) => Promise<void>;
  /** Decrypt the stored key into memory for this session. */
  unlock: (password: string) => Promise<void>;
  /** Wipe in-memory key material (ciphertext stays for next unlock). */
  lock: () => void;
  /** Forget the key for this network. */
  forget: () => void;
  /** Generate + register the viewing key on-chain (RFP bullet 1). */
  register: () => Promise<string>;
  /** Re-fetch registration, balances, fee. */
  refresh: () => Promise<void>;
  /** Pre-send check: does the recipient hold a registered viewing key? */
  checkRecipient: (addr: string) => Promise<boolean | undefined>;
  shield: (amount: number) => Promise<string>;
  sendPrivate: (recipient: string, amount: number) => Promise<string>;
  unshield: (amount: number) => Promise<string>;
}

async function hydrate(
  set: (p: Partial<SdkWalletState>) => void,
  get: () => SdkWalletState,
  network: SdkNetwork,
  privateKey: string,
) {
  const { address } = addressFromPrivateKey(privateKey);
  const cfg = sdkConfigFor(network);
  const account = accountFor(address, privateKey, network);
  const viewingKey = deriveViewingKey(privateKey, cfg.chainId, cfg.poolAddress);
  set({
    status: "ready",
    address,
    viewingKey,
    account,
    privateKey,
    locked: false,
    hasStoredKey: true,
    error: undefined,
  });
  await get().refresh();
}

/** Reset in-memory key material; keep `hasStoredKey` as given. */
function lockState(hasStoredKey: boolean): Partial<SdkWalletState> {
  return {
    status: "idle",
    error: undefined,
    busy: undefined,
    address: undefined,
    viewingKey: undefined,
    account: undefined,
    privateKey: undefined,
    locked: true,
    hasStoredKey,
    registered: false,
    deployed: false,
    shielded: undefined,
    publicStrk: undefined,
    history: [],
  };
}

export const useSdkStore = create<SdkWalletState>((set, get) => ({
  network: "sepolia",
  status: "idle",
  registered: false,
  deployed: false,
  feeStrk: 6,
  history: [],
  paymaster: "unknown",
  locked: true,
  hasStoredKey: false,

  setNetwork: (network) => {
    set({
      network,
      ...lockState(Boolean(loadCipher(network) ?? loadLegacy(network))),
      feeStrk: 6,
      paymaster: "unknown",
    });
  },

  generate: async (password) => {
    set({ busy: "generate", error: undefined });
    try {
      const { network } = get();
      const { privateKey } = generateThrowaway();
      saveCipher(network, await encryptPrivateKey(privateKey, password));
      await hydrate(set, get, network, privateKey);
    } catch (e) {
      set({ status: "error", error: String((e as Error)?.message ?? e) });
    } finally {
      set({ busy: undefined });
    }
  },

  importKey: async (raw, password) => {
    set({ busy: "import", error: undefined });
    try {
      const privateKey = raw.trim();
      if (!/^0x[0-9a-fA-F]{63,64}$/.test(privateKey)) {
        throw new Error("Invalid private key — expected a 0x hex string.");
      }
      // Throws on bad keys.
      addressFromPrivateKey(privateKey);
      saveCipher(get().network, await encryptPrivateKey(privateKey, password));
      await hydrate(set, get, get().network, privateKey);
    } catch (e) {
      set({ status: "error", error: String((e as Error)?.message ?? e) });
    } finally {
      set({ busy: undefined });
    }
  },

  unlock: async (password) => {
    set({ busy: "unlock", error: undefined });
    try {
      const { network } = get();
      const cipher = loadCipher(network);
      const legacy = cipher ? undefined : loadLegacy(network);
      if (!cipher && !legacy) throw new Error("No stored key on this network.");
      const privateKey = cipher
        ? await decryptPrivateKey(cipher, password)
        : legacy!;
      if (legacy) {
        // One-way migration: encrypt with the provided password, then drop
        // the plaintext (clearStoredKey removes legacy + any stale cipher).
        const migrated = await encryptPrivateKey(legacy, password);
        clearStoredKey(network);
        saveCipher(network, migrated);
      }
      await hydrate(set, get, network, privateKey);
    } catch (e) {
      set({ error: String((e as Error)?.message ?? e) });
    } finally {
      set({ busy: undefined });
    }
  },

  lock: () => {
    set(lockState(get().hasStoredKey));
  },

  forget: () => {
    const { network } = get();
    clearStoredKey(network);
    set({
      ...lockState(false),
      locked: true,
    });
  },

  register: async () => {
    const { account, address, network, privateKey } = get();
    if (!account || !address || !privateKey) {
      throw new Error("Unlock the key first — nothing is loaded into memory.");
    }
    set({ busy: "register", error: undefined });
    try {
      // Deploying and registering both cost gas — fail fast with a human
      // message instead of a raw "exceed balance" RPC blob.
      const funds = await fetchPublicStrkBalance(address, network);
      set({ publicStrk: funds });
      if (funds <= 0) {
        throw new Error(
          `This account is empty, so it can't pay for deployment or registration. ` +
            `Copy the address above, fund it (${network === "sepolia" ? "Sepolia STRK from faucet.starknet.io" : "STRK"}), ` +
            `wait a minute, then hit register again. Nothing was submitted.`,
        );
      }
      // Fresh accounts must exist on-chain ~10 blocks before the prover
      // snapshots them — deploy first, then wait out the maturity window.
      const { publicKey } = addressFromPrivateKey(privateKey);
      const dep = await ensureAccountDeployed({
        account,
        publicKey,
        network,
      });
      set({ deployed: true });
      if (dep.deployed) {
        const cfg = sdkConfigFor(network);
        const rpc = new RpcProvider({ nodeUrl: cfg.rpcUrl });
        await waitUntilMature(rpc, dep.block ?? (await rpc.getBlockNumber()), "account deployment");
      }
      const { txHash } = await generateAndRegisterViewingKey({
        account,
        privateKey,
        network,
      });
      logEvent({ route: "sdk", action: "sdk:register", ok: true, network });
      await get().refresh();
      return txHash;
    } catch (e) {
      const msg = friendlySdkError(e, network);
      logEvent({ route: "sdk", action: "sdk:register", ok: false, error: msg, network });
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ busy: undefined });
    }
  },

  refresh: async () => {
    const { account, address, viewingKey, network } = get();
    getPaymasterStatus()
      .then(({ sponsored }) =>
        set({ paymaster: sponsored ? "sponsored" : "self-pay" }),
      )
      .catch(() => {});
    if (!account || !address || !viewingKey) return;
    const cfg = sdkConfigFor(network);
    const rpc = new RpcProvider({ nodeUrl: cfg.rpcUrl });
    fetchPublicStrkBalance(address, network, rpc)
      .then((publicStrk) => {
        if (get().address === address) set({ publicStrk });
      })
      .catch(() => {});
    getPoolFeeStrk(network, rpc)
      .then((feeStrk) => {
        if (get().address === address) set({ feeStrk });
      })
      .catch(() => {});
    const registered = await isRegistered(address, network, rpc);
    if (!registered) {
      if (get().address === address) {
        set({ registered: false, shielded: 0 });
      }
      return;
    }
    try {
      const { shielded } = await discoverSdkNotes({
        account,
        viewingKey,
        network,
        provider: rpc,
      });
      if (get().address !== address) return;
      set({
        registered: true,
        deployed: true,
        shielded: feltToAmount(shielded, STRK.decimals),
        history: loadHistory(network, address),
      });
    } catch {
      if (get().address === address) set({ registered: true });
    }
  },

  checkRecipient: async (addr) => {
    const { network } = get();
    let parsed: string;
    try {
      parsed = validateAndParseAddress(addr.trim());
    } catch {
      return undefined;
    }
    try {
      return await isRegistered(parsed, network);
    } catch {
      return undefined;
    }
  },

  shield: async (amount) => {
    const { account, viewingKey, address, network } = get();
    if (!account || !viewingKey || !address) {
      throw new Error("No embedded key loaded.");
    }
    try {
      const txHash = await sdkShield({
        account,
        viewingKey,
        network,
        amount: amountToUnits(amount, STRK.decimals),
      });
      logEvent({ route: "sdk", action: "sdk:shield", ok: true, network });
      set({
        history: recordActivity(network, address, {
          kind: "shield",
          amount,
          txHash,
          ts: Date.now(),
        }),
      });
      void get().refresh();
      return txHash;
    } catch (e) {
      const msg = friendlySdkError(e, network);
      logEvent({ route: "sdk", action: "sdk:shield", ok: false, error: msg, network });
      throw new Error(msg);
    }
  },

  sendPrivate: async (recipient, amount) => {
    const { account, viewingKey, address, network } = get();
    if (!account || !viewingKey || !address) {
      throw new Error("No embedded key loaded.");
    }
    const units = amountToUnits(amount, STRK.decimals);

    // Sponsored first: status + fee + prove are all pre-submission, so any
    // failure here safely falls through to self-pay below.
    try {
      const { sponsored } = await getPaymasterStatus();
      if (!sponsored) throw new Error("sponsorship off");
      const fee = await fetchSponsoredFee({ network });
      const { callAndProof } = await sdkBuildPrivateTransfer({
        account,
        viewingKey,
        network,
        recipient,
        amount: units,
        fee: { token: fee.token, recipient: fee.recipient, amount: fee.amount },
      });
      // The proof now commits to the paymaster fee: from here on, relay
      // errors surface directly — no fallback (re-submitting self-paid would
      // still pay the paymaster fee for nothing).
      const call = callAndProof.call as {
        contractAddress: string;
        entrypoint: string;
        calldata: unknown[];
      };
      const txHash = await submitSponsored({
        network,
        poolFeeToken: STRK.address,
        callAndProof: {
          call: {
            contractAddress: String(call.contractAddress),
            entrypoint: call.entrypoint,
            calldata: [...call.calldata],
          },
          proof: {
            data: callAndProof.proof.data,
            proofFacts: [...callAndProof.proof.proofFacts],
          },
        },
      });
      const cfg = sdkConfigFor(network);
      await new RpcProvider({ nodeUrl: cfg.rpcUrl }).waitForTransaction(txHash);
      console.info("[sdk] sponsored send tx:", txHash);
      logEvent({ route: "sdk", action: "sdk:send", stage: "sponsored", ok: true, network });
      set({
        paymaster: "sponsored",
        history: recordActivity(network, address, {
          kind: "sent",
          amount,
          txHash,
          ts: Date.now(),
        }),
      });
      void get().refresh();
      return txHash;
    } catch (e) {
      console.info("[sdk] sponsored send unavailable, self-paying:", friendlySdkError(e, network));
      set({ paymaster: "self-pay" });
    }

    try {
      const txHash = await sdkSendPrivate({
        account,
        viewingKey,
        network,
        recipient,
        amount: units,
      });
      logEvent({ route: "sdk", action: "sdk:send", stage: "self-pay", ok: true, network });
      set({
        history: recordActivity(network, address, {
          kind: "sent",
          amount,
          txHash,
          ts: Date.now(),
        }),
      });
      void get().refresh();
      return txHash;
    } catch (e) {
      const msg = friendlySdkError(e, network);
      logEvent({ route: "sdk", action: "sdk:send", stage: "self-pay", ok: false, error: msg, network });
      throw new Error(msg);
    }
  },

  unshield: async (amount) => {
    const { account, viewingKey, address, network } = get();
    if (!account || !viewingKey || !address) {
      throw new Error("No embedded key loaded.");
    }
    try {
      const txHash = await sdkUnshield({
        account,
        viewingKey,
        network,
        amount: amountToUnits(amount, STRK.decimals),
      });
      logEvent({ route: "sdk", action: "sdk:unshield", ok: true, network });
      set({
        history: recordActivity(network, address, {
          kind: "unshield",
          amount,
          txHash,
          ts: Date.now(),
        }),
      });
      void get().refresh();
      return txHash;
    } catch (e) {
      const msg = friendlySdkError(e, network);
      logEvent({ route: "sdk", action: "sdk:unshield", ok: false, error: msg, network });
      throw new Error(msg);
    }
  },
}));

/**
 * Boot check: note whether a stored key exists (no silent decrypt — the user
 * unlocks with their password). Call once on mount.
 */
export function initSdkStore() {
  const { network } = useSdkStore.getState();
  const hasStoredKey = Boolean(loadCipher(network) ?? loadLegacy(network));
  useSdkStore.setState({ hasStoredKey, locked: true });
}

/**
 * Poll refresh() while unlocked + registered and the tab is visible.
 * Skips while an action is in flight. Returns cleanup for useEffect.
 */
export function startSdkPolling(intervalMs = 60_000): () => void {
  const id = setInterval(() => {
    if (document.hidden) return;
    const s = useSdkStore.getState();
    if (s.status !== "ready" || !s.registered || !s.address) return;
    if (s.busy) return;
    void s.refresh();
  }, intervalMs);
  return () => clearInterval(id);
}
