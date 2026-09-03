#!/usr/bin/env node
/**
 * Read-only live check of the SDK-route approach (mirrors lib/sdk.ts).
 * Native ESM (the SDK root has no CJS "require" export, so tsx/CJS fails).
 * No spends. Uses the .sepolia-throwaway.json key for discovery reads only.
 */
import { readFileSync } from "node:fs";
import { Account, RpcProvider, constants, ec, hash } from "starknet";
import { createPrivateTransfers } from "@starkware-libs/starknet-privacy-sdk";
import { ContractDiscoveryProvider } from "@starkware-libs/starknet-privacy-sdk/testing";

const SEPOLIA_RPC = "https://starknet-sepolia.drpc.org";
const POOL = "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";
const PROVER = "https://transaction-prover.alpha-sepolia.sw-dev.io";
const STRK = "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// Minimal RPC pool wrapper (same shape as RpcPoolContract in lib/sdk.ts).
function rpcPool(provider, poolAddress) {
  const call = (entrypoint, calldata = []) =>
    provider.callContract({ contractAddress: poolAddress, entrypoint, calldata });
  const num = async (entrypoint, calldata = []) =>
    BigInt((await call(entrypoint, calldata))[0] ?? "0");
  return {
    channel_exists: async (m) => (await num("channel_exists", [String(m)])) !== 0n,
    get_num_of_channels: (a) => num("get_num_of_channels", [String(a)]),
    get_channel_info: async (a, i) => {
      const r = await call("get_channel_info", [String(a), String(i)]);
      return { ephemeral_pubkey: r[0], enc_channel_key: r[1], enc_sender_addr: r[2] };
    },
    subchannel_exists: async (m) => (await num("subchannel_exists", [String(m)])) !== 0n,
    get_subchannel_info: async (id) => {
      const r = await call("get_subchannel_info", [String(id)]);
      return { salt: r[0], enc_token: r[1] };
    },
    get_outgoing_channel_info: async (id) => {
      const r = await call("get_outgoing_channel_info", [String(id)]);
      return { salt: r[0], enc_recipient_addr: r[1] };
    },
    get_note: async (id) => {
      const r = await call("get_note", [String(id)]);
      return { packed_value: r[0], token: r[1] };
    },
    nullifier_exists: async (n) => (await num("nullifier_exists", [String(n)])) !== 0n,
    get_public_key: async (a) => (await call("get_public_key", [String(a)]))[0] ?? "0",
    get_enc_private_key: async (a) => {
      const r = await call("get_enc_private_key", [String(a)]);
      return { auditor_public_key: r[0], ephemeral_pubkey: r[1], enc_private_key: r[2] };
    },
    get_auditor_public_key: async () => (await call("get_auditor_public_key"))[0],
    get_screener_public_key: async () => (await call("get_screener_public_key"))[0],
    get_version: async () => (await call("get_version"))[0],
    get_fee_amount: (async () => {
      const r = await call("get_fee_amount");
      return BigInt(r[0] ?? "0") + (BigInt(r[1] ?? "0") << 128n);
    }),
    get_fee_collector: async () => (await call("get_fee_collector"))[0],
    get_proof_validity_blocks: (a) => num("get_proof_validity_blocks"),
    get_open_note_screening_policy: async (d) =>
      (await call("get_open_note_screening_policy", [String(d)])),
  };
}

function deriveViewingKey(privateKey, chainId, poolAddress) {
  const MAX = ec.starkCurve.CURVE.n / 2n;
  const messageHash = hash.starknetKeccak(`${chainId}:${poolAddress}`);
  const sig = ec.starkCurve.sign(`0x${messageHash.toString(16)}`, privateKey);
  const folded = BigInt(hash.computePoseidonHashOnElements([sig.r, sig.s]));
  const order = ec.starkCurve.CURVE.n;
  const reduced = folded % order;
  const canonical = reduced < MAX ? reduced : order - reduced;
  return canonical === 0n ? 1n : canonical;
}

const { address, privateKey } = JSON.parse(
  readFileSync(new URL("../.sepolia-throwaway.json", import.meta.url), "utf8"),
);
console.log("throwaway:", address);

const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
const pk = await provider.callContract({
  contractAddress: POOL,
  entrypoint: "get_public_key",
  calldata: [address],
});
console.log("isRegistered(sepolia):", pk.some((f) => BigInt(f) !== 0n));

const viewingKey = deriveViewingKey(
  privateKey,
  constants.StarknetChainId.SN_SEPOLIA,
  POOL,
);
console.log("viewing key derived ok:", viewingKey > 0n);

const account = new Account({ provider, address, signer: privateKey, cairoVersion: "1" });
const transfers = createPrivateTransfers({
  account,
  viewingKeyProvider: { getViewingKey: async () => viewingKey },
  provingProvider: { url: PROVER, chainId: constants.StarknetChainId.SN_SEPOLIA },
  discoveryProvider: new ContractDiscoveryProvider(rpcPool(provider, POOL)),
  poolContractAddress: POOL,
});

const { notes } = await transfers.discoverNotes({ tokens: [BigInt(STRK)] });
const list = notes.get(BigInt(STRK)) ?? [];
const shielded = list.filter((n) => !n.open).reduce((s, n) => s + n.amount, 0n);
console.log(`discovery: ${list.length} note(s), shielded=${shielded}`);
for (const n of list.slice(0, 5)) {
  console.log(`  id=${n.id} amount=${n.amount} created=${n.created} open=${n.open}`);
}
console.log("SDK-CHECK PASS");
