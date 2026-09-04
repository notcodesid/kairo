import { NextResponse } from "next/server";
import {
  submitPrivateSwap,
  SEPOLIA_PAYMASTER_BASE_URL,
  type AvnuOptions,
} from "@avnu/avnu-sdk";

function optionsFor(network: string): AvnuOptions | undefined {
  if (network === "sepolia") {
    return { paymasterBaseUrl: SEPOLIA_PAYMASTER_BASE_URL };
  }
  return undefined; // mainnet default
}

interface IncomingCallAndProof {
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

/**
 * Relay a client-proven private tx through the paymaster (sponsored_private:
 * relayer pays gas, pool fee reimburses it from the shielded balance).
 * The key stays server-side; the client did all proving locally.
 */
export async function POST(req: Request) {
  const apiKey = process.env.PAYMASTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Paymaster sponsorship is not configured." },
      { status: 503 },
    );
  }
  let body: {
    network?: string;
    poolFeeToken?: string;
    callAndProof?: IncomingCallAndProof;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { network, poolFeeToken, callAndProof } = body;
  if (
    (network !== "sepolia" && network !== "mainnet") ||
    !poolFeeToken ||
    !callAndProof?.call ||
    !callAndProof?.proof
  ) {
    return NextResponse.json(
      { error: "network, poolFeeToken and callAndProof are required." },
      { status: 400 },
    );
  }
  const { contractAddress, entrypoint, calldata } = callAndProof.call;
  const { data, proofFacts } = callAndProof.proof;
  if (
    typeof contractAddress !== "string" ||
    typeof entrypoint !== "string" ||
    !Array.isArray(calldata) ||
    typeof data !== "string" ||
    !Array.isArray(proofFacts)
  ) {
    return NextResponse.json(
      { error: "Malformed callAndProof payload." },
      { status: 400 },
    );
  }
  try {
    const res = await submitPrivateSwap(
      {
        callAndProof: {
          call: {
            contractAddress,
            entrypoint,
            calldata: calldata.map((entry) => String(entry)),
          },
          proof: { data, proofFacts: proofFacts.map((f) => String(f)) },
        },
        feeMode: { poolFeeToken, tip: "normal" },
        paymasterApiKey: apiKey,
      },
      optionsFor(network),
    );
    const hash =
      (res as { transactionHash?: string }).transactionHash ??
      (res as { transaction_hash?: string }).transaction_hash;
    if (!hash) {
      return NextResponse.json(
        { error: "Paymaster returned no transaction hash." },
        { status: 502 },
      );
    }
    return NextResponse.json({ transactionHash: hash });
  } catch (e) {
    return NextResponse.json(
      { error: `Submit failed: ${String((e as Error)?.message ?? e).slice(0, 200)}` },
      { status: 502 },
    );
  }
}
