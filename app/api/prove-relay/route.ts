import { NextResponse } from "next/server";

/**
 * Starkscan prover translator (mainnet).
 *
 * The privacy SDK speaks direct JSON-RPC `starknet_proveTransaction` to a
 * prover URL. Starkscan's mainnet prover is an authenticated async relay:
 *   POST /v1/SN_MAIN/prove -> { jobId } -> GET /v1/SN_MAIN/prove/$JOB_ID (poll)
 * so it can't be used as a drop-in `NEXT_PUBLIC_PROVING_URL_MAINNET`.
 *
 * This route translates: set NEXT_PUBLIC_PROVING_URL_MAINNET=/api/prove-relay
 * and the SDK's existing `provingProvider: { url }` works unchanged.
 * Secret stays server-side (`STARKSCAN_API_KEY`), never NEXT_PUBLIC_.
 *
 * Timeout contract: proofs occupy the prover for minutes, so the SDK is
 * configured with `requestTimeoutMs: 600_000` (lib/sdk.ts) and this route
 * holds the request open up to OVERALL_TIMEOUT_MS below.
 *
 * Idempotency: the key is a SHA-256 of the request body, so SDK retries of
 * the same proof resume the original Starkscan job instead of burning a
 * fresh prover slot + daily-budget unit per attempt.
 */

// Hobby cap is 60s — higher values fail the deploy at "Deploying outputs".
// Proofs slower than this get cut; Pro plan allows up to 600.
export const maxDuration = 60;

const RELAY_BASE =
  process.env.STARKSCAN_RELAY_BASE || "https://api.starkscan.co/v1/SN_MAIN/prove";
const POLL_DEFAULT_S = 10;
const OVERALL_TIMEOUT_MS = 10 * 60_000;
/** Deposit attestations expire 300s after issued_at — warn below this margin. */
const ATTESTATION_WARN_MARGIN_S = 60;

function jsonRpc(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonRpcError(id: unknown, code: number, message: string, data?: string, http = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message, data } },
    { status: http },
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function POST(req: Request) {
  const apiKey = process.env.STARKSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "STARKSCAN_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: { block_id?: unknown; blockId?: unknown; transaction?: unknown } };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { id = 1, method, params } = body;

  // Health probes from the SDK — answer locally, no relay budget spent.
  if (method === "starknet_specVersion") {
    return jsonRpc(id, "0.10.0");
  }
  if (method !== "starknet_proveTransaction") {
    return jsonRpcError(id, -32601, `Unsupported method: ${method}`);
  }

  const starkscanBody = {
    block_id: params?.block_id ?? params?.blockId,
    transaction: params?.transaction,
  };
  if (!starkscanBody.block_id || !starkscanBody.transaction) {
    return jsonRpcError(id, -32602, "Missing block_id / transaction params.");
  }

  // Content-hash key: 64 hex chars, within Starkscan's 16–128 graphic-ASCII
  // rule. Same proof → same key → retry resumes the original job (HTTP 200
  // with the original jobId); different proof → different key → new job.
  const bodyBytes = new TextEncoder().encode(JSON.stringify(starkscanBody));
  const digest = await crypto.subtle.digest("SHA-256", bodyBytes);
  const idempotencyKey = [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  let submitRes: Response;
  try {
    submitRes = await fetch(RELAY_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Starkscan-Api-Key": apiKey,
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(starkscanBody),
    });
  } catch (e) {
    return jsonRpcError(id, -32005, `Relay unreachable: ${String(e).slice(0, 150)}`, undefined, 503);
  }

  if (!submitRes.ok) {
    const text = (await submitRes.text().catch(() => "")).slice(0, 300);
    if (submitRes.status === 403)
      return jsonRpcError(id, 403, "Key lacks prove scope — Key ID not whitelisted yet.", text);
    if (submitRes.status === 404)
      return jsonRpcError(id, -32005, "Prove relay not enabled in this environment (404).", text, 503);
    if (submitRes.status === 409)
      return jsonRpcError(id, -32603, `Idempotency conflict (409): ${text}`, text, 502);
    if (submitRes.status === 400)
      return jsonRpcError(id, -32603, `Bad prove request (400): ${text}`, text, 502);
    if (submitRes.status === 429 || submitRes.status === 503)
      return jsonRpcError(id, -32005, `Relay busy (${submitRes.status}): ${text}`, text, 503);
    return jsonRpcError(id, -32603, `Prove submit failed (${submitRes.status}): ${text}`, text, 502);
  }

  const submitJson = (await submitRes.json().catch(() => null)) as { jobId?: string } | null;
  const jobId = submitJson?.jobId;
  if (!jobId) return jsonRpcError(id, -32603, "Relay returned no jobId.", undefined, 502);

  // Poll until terminal. Persist first result immediately — delivered once.
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) {
      return jsonRpcError(id, -32005, `Prove timed out after 10m (job ${jobId}). Retry same tx — do not double-submit blindly.`, undefined, 503);
    }
    let pollRes: Response;
    try {
      pollRes = await fetch(`${RELAY_BASE}/${jobId}`, {
        headers: { "X-Starkscan-Api-Key": apiKey },
      });
    } catch {
      await sleep(POLL_DEFAULT_S * 1000);
      continue;
    }
    const poll = (await pollRes.json().catch(() => null)) as {
      status?: string;
      terminal?: boolean;
      result?: { proof: string; proof_facts: string[]; l2_to_l1_messages: unknown[]; additional_data?: { signature?: { issued_at?: number } } };
      error?: { code?: number; message?: string; data?: string };
      pollAfterSeconds?: number;
      resultUnavailableReason?: string;
    } | null;
    if (!poll) {
      await sleep(POLL_DEFAULT_S * 1000);
      continue;
    }
    if (!poll.terminal) {
      await sleep((poll.pollAfterSeconds ?? POLL_DEFAULT_S) * 1000);
      continue;
    }
    if (poll.status === "succeeded" && poll.result) {
      // Verbatim passthrough incl. additional_data (screening attestation).
      // Deposit attestations expire 300s after issued_at (pool
      // DEPOSITOR_VALIDATION_MAX_AGE) — flag a nearly-dead one so the
      // caller can re-prove instead of broadcasting a doomed deposit.
      // Transfers carry no attestation and are unaffected.
      const issuedAt = poll.result.additional_data?.signature?.issued_at;
      if (typeof issuedAt === "number") {
        const ageS = Date.now() / 1000 - issuedAt;
        if (ageS > 300 - ATTESTATION_WARN_MARGIN_S) {
          console.warn(
            `[prove-relay] attestation nearly expired (age ${Math.round(ageS)}s, job ${jobId}) — deposit may revert SCREENING_EXPIRED`,
          );
        }
      }
      return jsonRpc(id, poll.result);
    }
    if (poll.status === "succeeded") {
      return jsonRpcError(id, -32603, `Result gone (${poll.resultUnavailableReason ?? "delivered_or_expired"}). Resubmit as a new job — proof is not recoverable. Job ${jobId}.`, undefined, 502);
    }
    if (poll.status === "unavailable") {
      return jsonRpcError(id, -32005, `Prover unavailable (job ${jobId}). Retry with the same tx; contact support with jobId before opening a new job.`, undefined, 503);
    }
    if (poll.status === "unknown_delivery") {
      return jsonRpcError(id, -32603, `Delivery unknown (job ${jobId}). Do NOT auto-resubmit — contact support with jobId first.`, undefined, 502);
    }
    // failed — prover's own code passed through
    const code = typeof poll.error?.code === "number" ? poll.error.code : -32603;
    return jsonRpcError(id, code, poll.error?.message ?? "Prover rejected the transaction.", poll.error?.data);
  }
}
