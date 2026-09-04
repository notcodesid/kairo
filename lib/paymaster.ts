/**
 * Paymaster layer (AVNU) for SDK-route sends.
 *
 * Two modes, same privacy property (relayer submits → our address is never
 * the on-chain sender):
 *   sponsored — relayer pays gas, pool fee reimburses it from the shielded
 *     balance. Needs a Portal API key, which lives ONLY on the server
 *     (app/api/paymaster/*). Client talks to those routes, never the key.
 *   self-pay  — the embedded account submits its own tx (current behavior).
 *     Always available; used whenever sponsorship is unconfigured or fails
 *     before submission.
 *
 * This module is client-safe: no keys, no node-only imports.
 */

import type { SdkNetwork } from "@/lib/sdk";
import { STRK } from "@/lib/chain";

/** Fee quote over the wire (bigint-safe: amount is a decimal string). */
export interface SponsoredFee {
  token: string;
  recipient: string;
  amount: string;
}

export type PaymasterMode = "sponsored" | "self-pay";

/** bigint-safe JSON: converts bigints to decimal strings on the way out. */
export function stringifyWithBigint(value: unknown): string {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

/** Revive decimal-string bigints inside calldata arrays. */
export function reviveCalldata(calldata: unknown[]): unknown[] {
  return calldata.map((entry) => {
    if (typeof entry === "bigint") return entry.toString();
    return entry;
  });
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: stringifyWithBigint(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `Paymaster request failed (${res.status}).`);
  }
  return data;
}

/** Does the server hold a Portal key? Decides sponsored vs self-pay. */
export async function getPaymasterStatus(): Promise<{ sponsored: boolean }> {
  try {
    const res = await fetch("/api/paymaster/status", { cache: "no-store" });
    if (!res.ok) return { sponsored: false };
    return (await res.json()) as { sponsored: boolean };
  } catch {
    return { sponsored: false };
  }
}

/** Fee the paymaster requires withdrawn to it inside the private tx. */
export async function fetchSponsoredFee(args: {
  network: SdkNetwork;
  poolFeeToken?: string;
}): Promise<{ token: string; recipient: string; amount: bigint }> {
  const data = await postJson<SponsoredFee>("/api/paymaster/fee", {
    network: args.network,
    poolFeeToken: args.poolFeeToken ?? STRK.address,
  });
  return { token: data.token, recipient: data.recipient, amount: BigInt(data.amount) };
}

export interface SdkCallAndProof {
  call: {
    contractAddress: string;
    entrypoint: string;
    calldata: unknown[];
  };
  proof: {
    data: string;
    proofFacts: string[];
  };
}

/** Relay a proven private tx through the paymaster. Returns the tx hash. */
export async function submitSponsored(args: {
  network: SdkNetwork;
  callAndProof: SdkCallAndProof;
  poolFeeToken?: string;
}): Promise<string> {
  const data = await postJson<{ transactionHash: string }>(
    "/api/paymaster/submit",
    {
      network: args.network,
      poolFeeToken: args.poolFeeToken ?? STRK.address,
      callAndProof: {
        call: {
          ...args.callAndProof.call,
          calldata: reviveCalldata(args.callAndProof.call.calldata),
        },
        proof: args.callAndProof.proof,
      },
    },
  );
  if (!data.transactionHash) throw new Error("Paymaster returned no transaction hash.");
  return data.transactionHash;
}
