"use client";

/**
 * Lightweight diagnostics for the SDK route — telemetry without a backend.
 *
 * An in-memory ring buffer of structured action outcomes (never keys,
 * viewing keys, or full addresses — only explicit, safe fields). The user can
 * download the snapshot as JSON or POST it to /api/diagnostics, where it lands
 * in the host's server logs. Nothing leaves the browser unprompted.
 */

export interface DiagEvent {
  ts: number;
  route: "sdk" | "wallet";
  action: string;
  stage?: string;
  ok: boolean;
  error?: string;
  network?: string;
  ms?: number;
}

const MAX_EVENTS = 100;
const events: DiagEvent[] = [];

export function logEvent(e: Omit<DiagEvent, "ts">) {
  events.push({ ...e, ts: Date.now() });
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
}

export interface DiagSnapshot {
  exportedAt: string;
  userAgent?: string;
  sdk: {
    network?: string;
    registered?: boolean;
    paymaster?: string;
    locked?: boolean;
  };
  events: DiagEvent[];
}

export function buildSnapshot(sdkSummary: DiagSnapshot["sdk"]): DiagSnapshot {
  return {
    exportedAt: new Date().toISOString(),
    userAgent:
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    sdk: sdkSummary,
    events: events.slice(),
  };
}

/** POST the snapshot to the server log (explicit user action only). */
export async function reportDiagnostics(
  snapshot: DiagSnapshot,
): Promise<void> {
  const res = await fetch("/api/diagnostics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(snapshot).slice(0, 64_000),
  });
  if (!res.ok) throw new Error("Report failed — diagnostics kept locally.");
}

/** Download the snapshot as a JSON file. */
export function downloadDiagnostics(snapshot: DiagSnapshot) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kairo-diagnostics-${Date.now()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
