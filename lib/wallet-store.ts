"use client";

import { create } from "zustand";
import {
  WalletAccountV6,
  num,
  validateAndParseAddress,
  walletV6,
} from "starknet";
import { WALLET_API } from "@starknet-io/types-js";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { MAINNET_CHAIN_ID, STRK, provider } from "@/lib/chain";
import { amountToUnits, feltToAmount } from "@/lib/format";

export type Strk20Support =
  | "unknown"
  | "supported" // method present, viewing key registered — private balances live
  | "unregistered" // method present, but no viewing key yet (see below)
  | "unsupported"; // method absent (e.g. Braavos "Not implemented")

/**
 * Does the connected wallet speak the STRK20 Wallet API?
 * There is no capability method — probe `wallet_strk20Balances` and interpret
 * the failure mode. NOT_REGISTERED means the method EXISTS but the user has no
 * viewing key yet. There is no dapp-side register call: registration happens
 * inside Ready on the user's first in-wallet shield, so "unregistered" users
 * must be guided there (hackathon issue #121 / #190 findings).
 */
async function probeStrk20(
  wa: WalletAccountV6,
): Promise<{ support: Strk20Support; shielded?: number }> {
  try {
    const entries = (await wa.strk20Balances([STRK.address])) as Array<{
      token: string;
      balance: string;
    }>;
    const entry = Array.isArray(entries)
      ? (entries.find((e) => BigInt(e.token) === BigInt(STRK.address)) ??
        entries[0])
      : undefined;
    return {
      support: "supported",
      shielded: entry ? feltToAmount(entry.balance, STRK.decimals) : 0,
    };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (/NOT_REGISTERED/i.test(msg)) return { support: "unregistered" };
    return { support: "unsupported" }; // method absent / unimplemented / anything else
  }
}

/** Public (unshielded) STRK balance via plain RPC — no wallet prompt. */
async function fetchPublicStrk(address: string): Promise<number> {
  const res = await provider.callContract({
    contractAddress: STRK.address,
    entrypoint: "balanceOf",
    calldata: [address],
  });
  // u256 → [low, high]
  const low = BigInt(res[0] ?? "0");
  const high = BigInt(res[1] ?? "0");
  return feltToAmount(low + (high << 128n), STRK.decimals);
}

export type ConnectStatus = "idle" | "connecting" | "connected" | "error";

interface WalletState {
  /** Wallets discovered via wallet-standard (Ready, Braavos, …). */
  wallets: WalletWithStarknetFeatures[];
  status: ConnectStatus;
  error?: string;
  /** Checksummed account address once connected. */
  address?: string;
  walletName?: string;
  walletIcon?: string;
  chainId?: string;
  isMainnet: boolean;
  strk20: Strk20Support;
  /** Real shielded STRK balance (when strk20 === "supported"). */
  shielded?: number;
  /** Real public STRK balance, via RPC. */
  publicStrk?: number;
  /** The live starknet.js account — non-serializable, client-only. */
  account?: WalletAccountV6;

  connect: (wallet: WalletWithStarknetFeatures) => Promise<void>;
  disconnect: () => void;
  /** Private transfer via the wallet's STRK20 API. Resolves to the tx hash. */
  sendPrivate: (recipient: string, amount: number) => Promise<string>;
  /** Shield (deposit) via the wallet's STRK20 API. Resolves to the tx hash. */
  shield: (amount: number) => Promise<string>;
  /** Unshield (withdraw to own address). Resolves to the tx hash. */
  unshield: (amount: number) => Promise<string>;
  /** Re-fetch shielded + public balances (silent reads). */
  refresh: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallets: [],
  status: "idle",
  isMainnet: false,
  strk20: "unknown",

  connect: async (wallet) => {
    set({ status: "connecting", error: undefined });
    try {
      const wa = await WalletAccountV6.connect(provider, wallet);

      const accounts = await walletV6.requestAccounts(wallet);
      const raw = Array.isArray(accounts) ? accounts[0] : accounts;
      if (!raw) throw new Error("The wallet returned no account.");
      const address = validateAndParseAddress(raw);

      const permissions = await walletV6.getPermissions(wallet);
      if (!permissions.includes(WALLET_API.Permission.ACCOUNTS)) {
        throw new Error("The wallet declined the connection.");
      }

      const chainId = (await walletV6.requestChainId(wallet)) as string;
      const isMainnet = chainId === MAINNET_CHAIN_ID;

      set({
        status: "connected",
        account: wa,
        address,
        walletName: wallet.name,
        walletIcon: wallet.icon,
        chainId,
        isMainnet,
        strk20: "unknown",
      });

      // Public balance via plain RPC (no wallet prompt).
      fetchPublicStrk(address)
        .then((publicStrk) => set({ publicStrk }))
        .catch(() => {});

      // Probe STRK20 support — the answer drives the UI. User-initiated (the
      // user just clicked Connect); returns the shielded balance on success.
      const { support, shielded } = await probeStrk20(wa);
      console.info(
        `[kairo] wallet=${wallet.name} chain=${chainId} strk20=${support}` +
          (shielded !== undefined ? ` shielded=${shielded}` : ""),
      );
      set({ strk20: support, shielded });

      // Reflect wallet-side account/chain changes in the UI without a reload.
      unsubscribeWalletEvents?.();
      unsubscribeWalletEvents = walletV6.subscribeWalletEvent(wallet, (change) => {
        if (change.accounts && change.accounts.length === 0) {
          get().disconnect();
          return;
        }
        void get().refresh();
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      set({
        status: "error",
        error: /reject|declin|abort|denied/i.test(msg)
          ? "Connection was declined in the wallet."
          : msg,
      });
    }
  },

  sendPrivate: async (recipient, amount) => {
    const { account } = get();
    if (!account) throw new Error("Wallet not connected.");
    const actions = [
      {
        type: "transfer",
        token: STRK.address,
        amount: num.toHex(amountToUnits(amount, STRK.decimals)),
        recipient,
      },
    ] as WALLET_API.STRK20_ACTION[];
    // User-initiated (form submit). Ready may prompt once per action.
    const { transaction_hash } = await account.strk20InvokeTransaction(actions);
    console.info("[kairo] private send tx:", transaction_hash);
    await provider.waitForTransaction(transaction_hash, { retryInterval: 2500 });
    void get().refresh();
    return transaction_hash;
  },

  shield: async (amount) => {
    const { account } = get();
    if (!account) throw new Error("Wallet not connected.");
    const actions = [
      {
        type: "deposit", // deposit is always to self
        token: STRK.address,
        amount: num.toHex(amountToUnits(amount, STRK.decimals)),
      },
    ] as WALLET_API.STRK20_ACTION[];
    const { transaction_hash } = await account.strk20InvokeTransaction(actions);
    console.info("[kairo] shield tx:", transaction_hash);
    await provider.waitForTransaction(transaction_hash, { retryInterval: 2500 });
    void get().refresh();
    return transaction_hash;
  },

  unshield: async (amount) => {
    const { account, address } = get();
    if (!account || !address) throw new Error("Wallet not connected.");
    const actions = [
      {
        type: "withdraw",
        token: STRK.address,
        amount: num.toHex(amountToUnits(amount, STRK.decimals)),
        recipient: address, // withdraw to self — re-links this amount publicly
      },
    ] as WALLET_API.STRK20_ACTION[];
    const { transaction_hash } = await account.strk20InvokeTransaction(actions);
    console.info("[kairo] unshield tx:", transaction_hash);
    await provider.waitForTransaction(transaction_hash, { retryInterval: 2500 });
    void get().refresh();
    return transaction_hash;
  },

  refresh: async () => {
    const { account, address } = get();
    if (!account || !address) return;
    fetchPublicStrk(address)
      .then((publicStrk) => set({ publicStrk }))
      .catch(() => {});
    const { support, shielded } = await probeStrk20(account);
    set({ strk20: support, shielded });
  },

  disconnect: () => {
    unsubscribeWalletEvents?.();
    unsubscribeWalletEvents = undefined;
    set({
      status: "idle",
      account: undefined,
      address: undefined,
      walletName: undefined,
      walletIcon: undefined,
      chainId: undefined,
      isMainnet: false,
      strk20: "unknown",
      shielded: undefined,
      publicStrk: undefined,
      error: undefined,
    });
  },
}));

/** Unsubscribe from the connected wallet's change events, if any. */
let unsubscribeWalletEvents: (() => void) | undefined;

/**
 * Start wallet-standard discovery once on the client. Wallets register
 * asynchronously after page load, so we subscribe rather than read once.
 * Returns an unsubscribe cleanup for useEffect. Idempotent under Strict Mode:
 * each call creates its own store instance and cleans up after itself.
 */
export function startWalletDiscovery(): () => void {
  // eip1193Adapters: [] keeps MetaMask (and its unlock-popup spam) out.
  const store: Store = createStore({ eip1193Adapters: [] });
  const push = (list: readonly WalletWithStarknetFeatures[]) =>
    useWalletStore.setState({ wallets: list.slice() });

  push(store.getWallets());
  const unsub = store.subscribe((next) => push(next));
  return unsub;
}
