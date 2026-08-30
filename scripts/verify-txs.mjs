#!/usr/bin/env node
/**
 * Verify the transactions in strk20.json the way the hackathon judge does:
 * each must (1) exist on mainnet, (2) have succeeded, and (3) emit at least
 * one event FROM the STRK20 pool contract.
 *
 * Usage:
 *   node scripts/verify-txs.mjs            # checks strk20.json
 *   node scripts/verify-txs.mjs 0xabc…     # checks the given hash(es)
 *   node scripts/verify-txs.mjs --sepolia 0xabc…  # checks Sepolia (throwaway evidence)
 */

import { readFileSync } from "node:fs";
import { hash } from "starknet";

const SEPOLIA = process.argv.includes("--sepolia");
const RPC_URL = SEPOLIA
  ? "https://starknet-sepolia.drpc.org"
  : "https://rpc.starknet.lava.build";
const POOL = SEPOLIA
  ? 0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91n
  : 0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812an;

/** STRK20 pool events the judge looks for — labelled by selector. */
const KNOWN_EVENTS = ["ViewingKeySet", "Deposit", "EncNoteCreated", "Withdrawal"];
const EVENT_SELECTORS = new Map(
  KNOWN_EVENTS.map((name) => [hash.getSelectorFromName(name), name]),
);

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`);
  return body.result;
}

async function verify(hash) {
  let receipt;
  try {
    receipt = await rpc("starknet_getTransactionReceipt", [hash]);
  } catch (e) {
    return { hash, ok: false, reason: `not found (${e.message})` };
  }

  const status = receipt.execution_status ?? receipt.status;
  if (status !== "SUCCEEDED") {
    return { hash, ok: false, reason: `execution_status = ${status}` };
  }

  const events = receipt.events ?? [];
  const poolEvents = events.filter((ev) => {
    try {
      return BigInt(ev.from_address) === POOL;
    } catch {
      return false;
    }
  });
  if (poolEvents.length === 0) {
    return { hash, ok: false, reason: "no event from the STRK20 pool" };
  }

  const counts = new Map();
  for (const ev of poolEvents) {
    const key = ev.keys?.[0] ?? "?";
    const label = EVENT_SELECTORS.get(key) ?? `${key.slice(0, 10)}…`;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const eventSummary = [...counts.entries()]
    .map(([k, n]) => `${k}×${n}`)
    .join(", ");

  return {
    hash,
    ok: true,
    finality: receipt.finality_status,
    poolEvents: poolEvents.length,
    events: eventSummary,
    viewingKeyRegistered: counts.has("ViewingKeySet"),
  };
}

const args = process.argv.slice(2).filter((a) => a !== "--sepolia");
let hashes = args;
if (hashes.length === 0) {
  const json = JSON.parse(readFileSync(new URL("../strk20.json", import.meta.url)));
  hashes = json.transactions ?? [];
}

if (hashes.length === 0) {
  console.log("No transactions to verify (strk20.json is empty).");
  process.exit(0);
}

let failed = 0;
for (const hash of hashes) {
  const r = await verify(hash);
  if (r.ok) {
    console.log(`✅ ${hash}\n   SUCCEEDED · ${r.finality} · ${r.events}`);
    if (r.viewingKeyRegistered) {
      console.log("   viewing key registered ✓");
    }
  } else {
    failed++;
    console.log(`❌ ${hash}\n   ${r.reason}`);
  }
}

if (hashes.length < 3) {
  console.log(`\n⚠️  Only ${hashes.length}/3 required transactions present.`);
}
console.log(
  failed === 0
    ? `\nAll ${hashes.length} transaction(s) pass the submission checks.`
    : `\n${failed} transaction(s) FAIL — fix before the deadline.`,
);
process.exit(failed === 0 ? 0 : 1);
