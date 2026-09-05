import { NextResponse } from "next/server";

/**
 * Telemetry without a backend: the client POSTs a user-approved diagnostics
 * snapshot, and it lands in the host's server logs. Payload is capped and
 * never contains keys (the client only ever sends action outcomes).
 */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const snapshot = body as {
    exportedAt?: string;
    sdk?: Record<string, unknown>;
    events?: Array<Record<string, unknown>>;
  };
  if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.events)) {
    return NextResponse.json({ error: "Malformed snapshot." }, { status: 400 });
  }
  const failures = snapshot.events.filter((e) => e?.ok === false).length;
  console.info(
    `[diagnostics] report exportedAt=${String(snapshot.exportedAt ?? "?")} ` +
      `events=${snapshot.events.length} failures=${failures} ` +
      `sdk=${JSON.stringify(snapshot.sdk ?? {})}`,
  );
  for (const e of snapshot.events.slice(-20)) {
    if (e?.ok === false) {
      console.info(
        `  [diagnostics] ${String(e.action ?? "?")}: ${String(e.error ?? "unknown").slice(0, 160)}`,
      );
    }
  }
  return NextResponse.json({ ok: true });
}
