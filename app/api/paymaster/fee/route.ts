import { NextResponse } from "next/server";
import {
  buildPrivateSwapFee,
  SEPOLIA_PAYMASTER_BASE_URL,
  type AvnuOptions,
} from "@avnu/avnu-sdk";
import { POOL_ADDRESS, SEPOLIA_POOL_ADDRESS } from "@/lib/chain";

function optionsFor(network: string): AvnuOptions | undefined {
  if (network === "sepolia") {
    return { paymasterBaseUrl: SEPOLIA_PAYMASTER_BASE_URL };
  }
  return undefined; // mainnet default
}

function poolFor(network: string): string | undefined {
  if (network === "sepolia") return SEPOLIA_POOL_ADDRESS;
  if (network === "mainnet") return POOL_ADDRESS;
  return undefined;
}

/**
 * Fee quote for a sponsored private tx. The Portal key never leaves the
 * server: the client receives only { token, recipient, amount } and withdraws
 * it to the recipient inside its proven private transaction.
 */
export async function POST(req: Request) {
  const apiKey = process.env.PAYMASTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Paymaster sponsorship is not configured." },
      { status: 503 },
    );
  }
  let body: { network?: string; poolFeeToken?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const pool = poolFor(body.network ?? "");
  if (!pool || !body.poolFeeToken) {
    return NextResponse.json(
      { error: "Valid network and poolFeeToken are required." },
      { status: 400 },
    );
  }
  try {
    const fee = await buildPrivateSwapFee(
      {
        poolAddress: pool,
        feeMode: { poolFeeToken: body.poolFeeToken, tip: "normal" },
        paymasterApiKey: apiKey,
      },
      optionsFor(body.network ?? ""),
    );
    return NextResponse.json({
      token: fee.token,
      recipient: fee.recipient,
      amount: fee.amount.toString(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Fee quote failed: ${String((e as Error)?.message ?? e).slice(0, 200)}` },
      { status: 502 },
    );
  }
}
