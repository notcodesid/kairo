/**
 * SDK route data layer — the RFP-literal path.
 *
 * The app holds the viewing key, runs discovery itself, and builds proofs
 * itself via `createPrivateTransfers`. No wallet needed for privacy ops;
 * the account whose signer the app holds (embedded / throwaway) signs.
 *
 * Discovery needs NO hosted indexer: ContractDiscoveryProvider reads notes
 * straight from the pool contract over ordinary RPC — works on mainnet
 * today. Proving still needs a hosted proving service:
 *   Sepolia: public (transaction-prover.alpha-sepolia.sw-dev.io)
 *   Mainnet: unpublished (hackathon issue #124 open) → env-wired, throws a
 *            helpful error until StarkWare publishes it or we self-host.
 */

import {
  Account,
  RpcProvider,
  constants,
  ec,
  hash,
  type ProviderInterface,
} from "starknet";
import { createPrivateTransfers } from "@starkware-libs/starknet-privacy-sdk";
import { ContractDiscoveryProvider } from "@starkware-libs/starknet-privacy-sdk/testing";
import type { PoolContractInterface } from "@starkware-libs/starknet-privacy-sdk/testing";
import {
  POOL_ADDRESS,
  SEPOLIA_POOL_ADDRESS,
  SEPOLIA_RPC_URL,
  RPC_URL,
  STRK,
} from "@/lib/chain";
import { deriveViewingKey } from "@/lib/viewing-key";

export type SdkNetwork = "mainnet" | "sepolia";

/** Public Sepolia proving service — the only published proving URL. */
export const SEPOLIA_PROVER_URL =
  "https://transaction-prover.alpha-sepolia.sw-dev.io";

/** Mainnet proving service — unpublished. Override via env when available. */
export function mainnetProverUrl(): string | undefined {
  const v =
    process.env.NEXT_PUBLIC_PROVING_URL_MAINNET ??
    process.env.PROVING_SERVICE_URL_MAINNET;
  return v && v.length > 0 ? v : undefined;
}

export interface SdkConfig {
  network: SdkNetwork;
  poolAddress: string;
  chainId: string;
  rpcUrl: string;
  /** Undefined on mainnet until StarkWare publishes the URL. */
  proverUrl: string | undefined;
}

export function sdkConfigFor(network: SdkNetwork): SdkConfig {
  if (network === "sepolia") {
    return {
      network,
      poolAddress: SEPOLIA_POOL_ADDRESS,
      chainId: constants.StarknetChainId.SN_SEPOLIA,
      rpcUrl: SEPOLIA_RPC_URL,
      proverUrl: SEPOLIA_PROVER_URL,
    };
  }
  return {
    network,
    poolAddress: POOL_ADDRESS,
    chainId: constants.StarknetChainId.SN_MAIN,
    rpcUrl: RPC_URL,
    proverUrl: mainnetProverUrl(),
  };
}

/**
 * Minimal RPC-backed pool contract for ContractDiscoveryProvider.
 * Implements PoolContractInterface via plain `callContract` — no ABI import,
 * no hosted indexer. Works on any network with a public RPC.
 */
class RpcPoolContract implements PoolContractInterface {
  constructor(
    private provider: ProviderInterface,
    private poolAddress: string,
  ) {}

  private async call(entrypoint: string, calldata: string[] = []) {
    return this.provider.callContract({
      contractAddress: this.poolAddress,
      entrypoint,
      calldata,
    });
  }

  async channel_exists(channelMarker: string | bigint) {
    const r = await this.call("channel_exists", [String(channelMarker)]);
    return BigInt(r[0] ?? "0") !== 0n;
  }
  async get_num_of_channels(recipientAddr: string | bigint) {
    const r = await this.call("get_num_of_channels", [String(recipientAddr)]);
    return BigInt(r[0] ?? "0");
  }
  async get_channel_info(
    recipientAddr: string | bigint,
    channelIndex: string | bigint,
  ) {
    const r = await this.call("get_channel_info", [
      String(recipientAddr),
      String(channelIndex),
    ]);
    return {
      ephemeral_pubkey: r[0] ?? "0",
      enc_channel_key: r[1] ?? "0",
      enc_sender_addr: r[2] ?? "0",
    };
  }
  async subchannel_exists(subchannelMarker: string | bigint) {
    const r = await this.call("subchannel_exists", [String(subchannelMarker)]);
    return BigInt(r[0] ?? "0") !== 0n;
  }
  async get_subchannel_info(subchannelId: string | bigint) {
    const r = await this.call("get_subchannel_info", [String(subchannelId)]);
    return { salt: r[0] ?? "0", enc_token: r[1] ?? "0" };
  }
  async get_outgoing_channel_info(outgoingChannelId: string | bigint) {
    const r = await this.call("get_outgoing_channel_info", [
      String(outgoingChannelId),
    ]);
    return { salt: r[0] ?? "0", enc_recipient_addr: r[1] ?? "0" };
  }
  async get_note(noteId: string | bigint) {
    const r = await this.call("get_note", [String(noteId)]);
    return { packed_value: r[0] ?? "0", token: r[1] ?? "0" };
  }
  async nullifier_exists(nullifier: string | bigint) {
    const r = await this.call("nullifier_exists", [String(nullifier)]);
    return BigInt(r[0] ?? "0") !== 0n;
  }
  async get_public_key(userAddr: string | bigint) {
    const r = await this.call("get_public_key", [String(userAddr)]);
    return r[0] ?? "0";
  }
  async get_enc_private_key(userAddr: string | bigint) {
    const r = await this.call("get_enc_private_key", [String(userAddr)]);
    return {
      auditor_public_key: r[0] ?? "0",
      ephemeral_pubkey: r[1] ?? "0",
      enc_private_key: r[2] ?? "0",
    };
  }
  async get_auditor_public_key() {
    const r = await this.call("get_auditor_public_key");
    return r[0] ?? "0";
  }
  async get_screener_public_key() {
    const r = await this.call("get_screener_public_key");
    return r[0] ?? "0";
  }
  async get_version() {
    const r = await this.call("get_version");
    return r[0] ?? "0";
  }
  async get_fee_amount() {
    const r = await this.call("get_fee_amount");
    return BigInt(r[0] ?? "0") + (BigInt(r[1] ?? "0") << 128n);
  }
  async get_fee_collector() {
    const r = await this.call("get_fee_collector");
    return r[0] ?? "0";
  }
  async get_proof_validity_blocks() {
    const r = await this.call("get_proof_validity_blocks");
    return BigInt(r[0] ?? "0");
  }
  async get_open_note_screening_policy(depositor: string | bigint) {
    const r = await this.call("get_open_note_screening_policy", [
      String(depositor),
    ]);
    // CairoCustomEnum-shaped passthrough; the SDK only forwards it.
    return r as unknown as import("starknet").CairoCustomEnum;
  }
}

/** Proving block must sit 10 back: note maturity + reorg buffer + sequencer window. */
export async function provingBlockId(provider: ProviderInterface) {
  return (await provider.getBlockNumber()) - 10;
}

export interface SdkTransfersArgs {
  /** Account whose signer the app holds (embedded / throwaway — never a wallet-held account). */
  account: Account;
  viewingKey: bigint;
  network: SdkNetwork;
  /** Override RPC provider (defaults to per-network public RPC). */
  provider?: ProviderInterface;
}

/**
 * Build the SDK's PrivateTransfers client: app-held viewing key, hosted
 * proving service, contract-based discovery over RPC. Throws on mainnet
 * until a proving URL is configured — callers should surface this as
 * "SDK sends unavailable on mainnet yet" rather than a generic failure.
 */
export function createSdkTransfers({
  account,
  viewingKey,
  network,
  provider,
}: SdkTransfersArgs) {
  const cfg = sdkConfigFor(network);
  if (!cfg.proverUrl) {
    throw new Error(
      "SDK proving is unavailable on mainnet: no proving service URL is published yet " +
        "(hackathon issue #124). Set NEXT_PUBLIC_PROVING_URL_MAINNET once StarkWare publishes it, " +
        "or use Sepolia where the proving service is public.",
    );
  }
  const rpc = provider ?? new RpcProvider({ nodeUrl: cfg.rpcUrl });
  const pool = new RpcPoolContract(rpc, cfg.poolAddress);
  return createPrivateTransfers({
    account,
    viewingKeyProvider: { getViewingKey: async () => viewingKey },
    provingProvider: { url: cfg.proverUrl, chainId: cfg.chainId as never },
    discoveryProvider: new ContractDiscoveryProvider(pool),
    poolContractAddress: cfg.poolAddress,
  });
}

/* ------------------------- RFP bullet 1: viewing key ------------------------ */

export { deriveViewingKey };

/** True iff this address has a viewing key registered in the pool. */
export async function isRegistered(
  address: string,
  network: SdkNetwork,
  provider?: ProviderInterface,
): Promise<boolean> {
  const cfg = sdkConfigFor(network);
  const rpc = provider ?? new RpcProvider({ nodeUrl: cfg.rpcUrl });
  const res = await rpc.callContract({
    contractAddress: cfg.poolAddress,
    entrypoint: "get_public_key",
    calldata: [address],
  });
  return res.some((f) => {
    try {
      return BigInt(f) !== 0n;
    } catch {
      return false;
    }
  });
}

/**
 * GENERATE + REGISTER the viewing key for an app-held account (RFP bullet 1,
 * literally). Derives canonically from the account's private key, then submits
 * the SDK's SetViewingKey action. Never call for wallet-held (Ready) accounts:
 * registration is immutable and would permanently mismatch the wallet's own key.
 * Returns the registration tx hash.
 */
export async function generateAndRegisterViewingKey(args: {
  account: Account;
  privateKey: string;
  network: SdkNetwork;
  provider?: ProviderInterface;
}): Promise<{ viewingKey: bigint; txHash: string }> {
  const { account, privateKey, network } = args;
  const cfg = sdkConfigFor(network);
  const rpc =
    args.provider ?? new RpcProvider({ nodeUrl: cfg.rpcUrl });
  const viewingKey = deriveViewingKey(privateKey, cfg.chainId, cfg.poolAddress);

  if (await isRegistered(account.address, network, rpc)) {
    throw new Error("Viewing key already registered for this account.");
  }

  const transfers = createSdkTransfers({
    account,
    viewingKey,
    network,
    provider: rpc,
  });
  const block = await provingBlockId(rpc);
  const { callAndProof } = await transfers
    .build()
    .register()
    .execute({ provingBlockId: block });
  const proof = callAndProof.proof;
  const tx = await account.execute(callAndProof.call, {
    proofFacts: proof?.proofFacts?.length ? proof.proofFacts : undefined,
    proof: proof?.proofFacts?.length ? proof.data : undefined,
  });
  await rpc.waitForTransaction(tx.transaction_hash);
  return { viewingKey, txHash: tx.transaction_hash };
}

/* --------------------- RFP bullet 3: app-run discovery ---------------------- */

export interface DiscoveredNote {
  id: string;
  amount: bigint;
  created?: number | null;
  open?: boolean;
}

/** Discover our notes via the pool contract (no indexer). Returns per-token notes. */
export async function discoverSdkNotes(args: {
  account: Account;
  viewingKey: bigint;
  network: SdkNetwork;
  tokens?: bigint[];
  provider?: ProviderInterface;
}): Promise<{ notes: DiscoveredNote[]; shielded: bigint }> {
  const { account, viewingKey, network } = args;
  const cfg = sdkConfigFor(network);
  const rpc =
    args.provider ?? new RpcProvider({ nodeUrl: cfg.rpcUrl });
  const transfers = createSdkTransfers({
    account,
    viewingKey,
    network,
    provider: rpc,
  });
  const tokenList = args.tokens ?? [BigInt(STRK.address)];
  const { notes } = await transfers.discoverNotes({ tokens: tokenList });
  const list = tokenList.flatMap((t) => notes.get(t) ?? []);
  const open = list.filter((n) => !n.open);
  void open;
  const all: DiscoveredNote[] = list.map((n) => ({
    id: String(n.id),
    amount: n.amount,
    created: typeof n.created === "number" ? n.created : null,
    open: n.open,
  }));
  const shielded = all
    .filter((n) => !n.open)
    .reduce((s, n) => s + n.amount, 0n);
  return { notes: all, shielded };
}

/* ----------------- RFP bullet 4: shield / send / unshield ------------------- */

async function submitCallAndProof(
  account: Account,
  rpc: ProviderInterface,
  callAndProof: { call: Parameters<Account["execute"]>[0]; proof: { proofFacts: string[]; data: string } },
  label: string,
): Promise<string> {
  const proof = callAndProof.proof;
  const hasProof = (proof?.proofFacts?.length ?? 0) > 0;
  const tx = await account.execute(callAndProof.call, {
    ...(hasProof
      ? { proofFacts: proof.proofFacts, proof: proof.data }
      : {}),
  });
  console.info(`[sdk] ${label} tx:`, tx.transaction_hash);
  await rpc.waitForTransaction(tx.transaction_hash);
  return tx.transaction_hash;
}

async function waitMaturity(rpc: ProviderInterface, created: number) {
  let latest = await rpc.getBlockNumber();
  while (latest - 10 < created + 10) {
    await new Promise((r) => setTimeout(r, 10_000));
    latest = await rpc.getBlockNumber();
  }
  return latest - 10;
}

/** Shield (deposit) via the SDK. Returns tx hash. */
export async function sdkShield(args: {
  account: Account;
  viewingKey: bigint;
  network: SdkNetwork;
  amount: bigint;
  token?: string;
  provider?: ProviderInterface;
}): Promise<string> {
  const { account, viewingKey, network, amount } = args;
  const cfg = sdkConfigFor(network);
  const rpc =
    args.provider ?? new RpcProvider({ nodeUrl: cfg.rpcUrl });
  const token = args.token ?? STRK.address;
  const transfers = createSdkTransfers({
    account,
    viewingKey,
    network,
    provider: rpc,
  });
  const block = await provingBlockId(rpc);
  const { callAndProof } = await transfers
    .build({ autoSetup: true })
    .with(token, (t) => t.deposit({ amount }))
    .surplusTo(account.address)
    .execute({ provingBlockId: block });
  return submitCallAndProof(account, rpc, callAndProof, "shield");
}

/** Private transfer via the SDK. Returns tx hash. */
export async function sdkSendPrivate(args: {
  account: Account;
  viewingKey: bigint;
  network: SdkNetwork;
  recipient: string;
  amount: bigint;
  token?: string;
  provider?: ProviderInterface;
}): Promise<string> {
  const { account, viewingKey, network, recipient, amount } = args;
  const cfg = sdkConfigFor(network);
  const rpc =
    args.provider ?? new RpcProvider({ nodeUrl: cfg.rpcUrl });
  const token = args.token ?? STRK.address;
  const transfers = createSdkTransfers({
    account,
    viewingKey,
    network,
    provider: rpc,
  });
  const { notes } = await transfers.discoverNotes({
    tokens: [BigInt(token)],
  });
  const list = notes.get(BigInt(token)) ?? [];
  const spendable = list.filter((n) => !n.open);
  if (spendable.length === 0) throw new Error("No spendable notes — shield first.");
  const note = spendable.reduce((a, b) => (a.amount >= b.amount ? a : b));
  const block = await waitMaturity(rpc, Number(note.created ?? 0));
  const { callAndProof } = await transfers
    .build({ autoSetup: true })
    .surplusTo(account.address)
    .with(token, (t) => t.inputs(note).transfer({ recipient, amount }))
    .execute({ provingBlockId: block });
  return submitCallAndProof(account, rpc, callAndProof, "private send");
}

/** Unshield (withdraw to own address) via the SDK. Returns tx hash. */
export async function sdkUnshield(args: {
  account: Account;
  viewingKey: bigint;
  network: SdkNetwork;
  amount: bigint;
  token?: string;
  provider?: ProviderInterface;
}): Promise<string> {
  const { account, viewingKey, network, amount } = args;
  const cfg = sdkConfigFor(network);
  const rpc =
    args.provider ?? new RpcProvider({ nodeUrl: cfg.rpcUrl });
  const token = args.token ?? STRK.address;
  const transfers = createSdkTransfers({
    account,
    viewingKey,
    network,
    provider: rpc,
  });
  const { notes } = await transfers.discoverNotes({
    tokens: [BigInt(token)],
  });
  const list = notes.get(BigInt(token)) ?? [];
  const spendable = list.filter((n) => !n.open);
  if (spendable.length === 0) throw new Error("No spendable notes — shield first.");
  const note = spendable.reduce((a, b) => (a.amount >= b.amount ? a : b));
  const block = await waitMaturity(rpc, Number(note.created ?? 0));
  const { callAndProof } = await transfers
    .build()
    .surplusTo(account.address)
    .with(token, (t) =>
      t.inputs(note).withdraw({ amount, recipient: account.address }),
    )
    .execute({ provingBlockId: block });
  return submitCallAndProof(account, rpc, callAndProof, "unshield");
}

/* ------------------- Embedded account helpers (Sepolia) --------------------- */

/** OZ account class hash used by scripts/register-sepolia.mjs. */
export const OZ_CLASS_HASH =
  "0x5b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564";

/** Generate a fresh throwaway keypair + address (Sepolia testing / SDK demo). */
export function generateThrowaway() {
  const privateKey =
    "0x" + Buffer.from(ec.starkCurve.utils.randomPrivateKey()).toString("hex");
  const publicKey = ec.starkCurve.getStarkKey(privateKey);
  const address = hash.calculateContractAddressFromHash(
    publicKey,
    OZ_CLASS_HASH,
    [publicKey],
    0,
  );
  return { privateKey, publicKey, address };
}
