"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Shield } from "@/components/icons";
import { addressUrl } from "@/lib/explorer";
import { truncateAddress } from "@/lib/format";
import { mainnetProverUrl, type SdkNetwork } from "@/lib/sdk";
import { useSdkStore } from "@/lib/sdk-store";
import {
  buildSnapshot,
  downloadDiagnostics,
  reportDiagnostics,
} from "@/lib/diagnostics";
import { PrimaryButton } from "@/components/screens";

/**
 * Selective disclosure for auditors: reveals the viewing key (detection
 * only — it cannot move funds), with explicit warnings. This is the
 * "auditable on demand, not a mixer" half of the STRK20 story.
 */
function DisclosureBlock({
  viewingKey,
  network,
}: {
  viewingKey?: bigint;
  network: SdkNetwork;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  if (!viewingKey) return null;
  const hex = `0x${viewingKey.toString(16)}`;

  async function copy() {
    try {
      await navigator.clipboard?.writeText(hex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="rounded-2xl bg-surface-2/40 p-4 ring-1 ring-border">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] font-semibold text-fg">Auditor disclosure</p>
        <button
          type="button"
          onClick={() => setRevealed((v) => !v)}
          className="rounded-xl bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
        >
          {revealed ? "Hide viewing key" : "Disclose viewing key"}
        </button>
      </div>
      {revealed && (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] leading-relaxed text-warning">
            Handing this over reveals your full incoming payment graph on{" "}
            {network} to whoever holds it. It grants detection only — no one
            can move funds with it. Share solely with an auditor you trust.
          </p>
          <p className="break-all font-mono text-[12px] text-muted select-all">
            {hex}
          </p>
          <button
            type="button"
            onClick={() => void copy()}
            className="flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy viewing key"}
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * User-triggered diagnostics: download a JSON snapshot or POST it to the
 * server log. Nothing leaves the browser unprompted; snapshots contain action
 * outcomes only — never keys.
 */
function DiagnosticsRow() {
  const { network, registered, paymaster, locked } = useSdkStore();
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function report() {
    setState("sending");
    try {
      await reportDiagnostics(buildSnapshot({ network, registered, paymaster, locked }));
      setState("sent");
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("failed");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() =>
          downloadDiagnostics(buildSnapshot({ network, registered, paymaster, locked }))
        }
        className="rounded-xl bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
      >
        Download diagnostics
      </button>
      <button
        type="button"
        onClick={() => void report()}
        disabled={state === "sending"}
        className="rounded-xl bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg disabled:opacity-50"
      >
        {state === "sending"
          ? "Reporting…"
          : state === "sent"
            ? "Reported ✓"
            : state === "failed"
              ? "Report failed"
              : "Report to team"}
      </button>
    </div>
  );
}

/**
 * Onboarding for the SDK route: the app holds the key, so first use means
 * generating (or importing) an embedded throwaway key and registering its
 * viewing key on-chain — RFP bullet 1, done inside Kairo itself.
 * Sepolia-first; mainnet SDK sends unlock when a proving URL is configured.
 */
export function SdkSetupCard() {
  const {
    network,
    status,
    busy,
    error,
    address,
    registered,
    publicStrk,
    paymaster,
    locked,
    hasStoredKey,
    privateKey,
    viewingKey,
    setNetwork,
    generate,
    importKey,
    unlock,
    lock,
    forget,
    register,
  } = useSdkStore();
  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [importPw, setImportPw] = useState("");
  const [unlockPw, setUnlockPw] = useState("");
  const [localError, setLocalError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  const hasKey = status === "ready" && address && !locked;
  const mainnetBlocked = network === "mainnet" && !mainnetProverUrl();

  function passwordsMatch(a: string, b: string): boolean {
    if (a.length < 8) {
      setLocalError("Password must be at least 8 characters.");
      return false;
    }
    if (a !== b) {
      setLocalError("Passwords don't match.");
      return false;
    }
    setLocalError(undefined);
    return true;
  }

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard?.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function copyKey() {
    if (!privateKey) return;
    try {
      await navigator.clipboard?.writeText(privateKey);
      setKeyCopied(true);
      setTimeout(() => setKeyCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  const inputCls =
    "h-13 w-full rounded-2xl bg-surface px-4 font-mono text-[13px] text-fg ring-1 ring-border transition-all placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent";

  const disclosure = <DisclosureBlock viewingKey={viewingKey} network={network} />;

  return (
    <section className="overflow-hidden rounded-3xl bg-surface/90 p-6 ring-1 ring-border backdrop-blur-xl transition-all">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <KeyRound size={20} />
          </span>
          <div>
            <h2 className="text-[16px] font-bold text-fg">SDK wallet — app-held key</h2>
            <p className="text-[12px] text-faint">
              Kairo generates the viewing key and registers it itself
            </p>
          </div>
        </div>
        {/* Network toggle */}
        <div className="flex items-center gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
          {(["sepolia", "mainnet"] as SdkNetwork[]).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNetwork(n)}
              disabled={busy !== undefined}
              className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-all disabled:opacity-40 ${
                network === n
                  ? "bg-surface-2 text-accent ring-1 ring-border-strong font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {mainnetBlocked && (
        <p className="mt-4 rounded-2xl bg-surface-2/40 p-4 text-[12px] leading-relaxed text-warning ring-1 ring-border">
          Mainnet SDK sends need a proving service URL, which StarkWare
          hasn&apos;t published yet. Discovery and key setup read live data, but
          proving stays on Sepolia until then — set{" "}
          <span className="font-mono">NEXT_PUBLIC_PROVING_URL_MAINNET</span> to
          unlock it with zero code changes.
        </p>
      )}

      {locked && hasStoredKey ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setLocalError(undefined);
            void unlock(unlockPw).finally(() => setUnlockPw(""));
          }}
          className="mt-5 space-y-3"
        >
          <p className="text-[13px] leading-relaxed text-muted">
            A key is stored on {network} — encrypted with your password. Unlock
            it to continue. The plaintext never leaves this browser&apos;s memory.
          </p>
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={unlockPw}
            onChange={(e) => setUnlockPw(e.target.value)}
            className={inputCls}
          />
          <PrimaryButton type="submit" busy={busy === "unlock"}>
            {busy === "unlock" ? "Unlocking…" : "Unlock key"}
          </PrimaryButton>
          {(error || localError) && (
            <p className="text-[13px] text-danger">{localError ?? error}</p>
          )}
          <button
            type="button"
            onClick={() => {
              setUnlockPw("");
              forget();
            }}
            className="text-[12px] text-faint hover:text-danger"
          >
            Forget this key entirely
          </button>
        </form>
      ) : !hasKey ? (
        <div className="mt-5 space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">
            No embedded key on {network} yet. Generate a fresh throwaway (fund
            it from a faucet), or import an existing test key. It&apos;s
            encrypted with a password before anything touches storage.
            Throwaway keys only — never use real funds here.
          </p>
          {!importOpen ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!passwordsMatch(newPw, confirmPw)) return;
                const pw = newPw;
                setNewPw("");
                setConfirmPw("");
                void generate(pw);
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="New password (8+ chars)"
                  value={newPw}
                  onChange={(e) => setNewPw(e.target.value)}
                  className={inputCls}
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="Confirm password"
                  value={confirmPw}
                  onChange={(e) => setConfirmPw(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <PrimaryButton type="submit" busy={busy === "generate"}>
                    {busy === "generate" ? "Generating…" : "Generate throwaway key"}
                  </PrimaryButton>
                </div>
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="flex h-13 items-center justify-center rounded-2xl bg-surface-2 px-5 text-[14px] font-semibold text-fg ring-1 ring-border transition-colors hover:bg-surface-2/80"
                >
                  Import key
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (importPw.length < 8) {
                  setLocalError("Password must be at least 8 characters.");
                  return;
                }
                setLocalError(undefined);
                const pw = importPw;
                setImportPw("");
                void importKey(importValue, pw);
              }}
              className="space-y-3"
            >
              <input
                type="password"
                autoComplete="off"
                spellCheck={false}
                placeholder="0x… private key"
                value={importValue}
                onChange={(e) => setImportValue(e.target.value)}
                className={inputCls}
              />
              <input
                type="password"
                autoComplete="new-password"
                placeholder="Encrypt with password (8+ chars)"
                value={importPw}
                onChange={(e) => setImportPw(e.target.value)}
                className={inputCls}
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <PrimaryButton type="submit" busy={busy === "import"}>
                    {busy === "import" ? "Importing…" : "Import"}
                  </PrimaryButton>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setImportOpen(false);
                    setImportValue("");
                    setImportPw("");
                  }}
                  className="flex h-13 items-center justify-center rounded-2xl bg-surface-2 px-5 text-[14px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {(error || localError) && (
            <p className="text-[13px] text-danger">{localError ?? error}</p>
          )}
        </div>
      ) : !registered ? (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2 rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
            <span className="break-all font-mono text-[12px] text-muted select-all">
              {address}
            </span>
            <button
              type="button"
              onClick={() => void copyAddress()}
              className="ml-auto shrink-0 text-muted transition-colors hover:text-fg"
              aria-label="Copy address"
            >
              {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </button>
            <a
              href={addressUrl(address, network)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-accent hover:underline"
              aria-label="View on Voyager"
            >
              <ExternalLink size={14} />
            </a>
          </div>

          {(publicStrk ?? 0) === 0 && (
            <p className="rounded-2xl bg-surface-2/40 p-4 text-[12px] leading-relaxed text-muted ring-1 ring-border">
              Fund this address first —{" "}
              <a
                href="https://faucet.starknet.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                faucet.starknet.io
              </a>{" "}
              for Sepolia STRK. Registration and shielding both need a funded,
              deployed account.
            </p>
          )}

          <ol className="space-y-3">
            {[
              "Kairo derives your viewing key from this account (canonical StarkWare recipe)",
              "One on-chain registration — emits ViewingKeySet in the privacy pool",
              "After that: shield, send privately, and unshield without any wallet",
            ].map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-3 text-[13px] leading-relaxed text-muted"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-accent ring-1 ring-border">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          <PrimaryButton busy={busy === "register"} onClick={() => void register()}>
            {busy === "register" ? (
              "Registering viewing key…"
            ) : (
              <>
                <Shield size={16} /> Generate + register viewing key
              </>
            )}
          </PrimaryButton>
          {error && <p className="text-[13px] text-danger">{error}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setShowKey(false);
                lock();
              }}
              className="rounded-xl bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
            >
              Lock key
            </button>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded-xl bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
            >
              {showKey ? "Hide backup" : "Back up key"}
            </button>
            <button
              type="button"
              onClick={forget}
              className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-faint ring-1 ring-transparent transition-colors hover:text-danger"
            >
              Forget
            </button>
          </div>
          {showKey && privateKey && (
            <div className="space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-border">
              <p className="text-[12px] leading-relaxed text-warning">
                Anyone with this key controls the account. Copy it somewhere
                safe, then hide it.
              </p>
              <p className="break-all font-mono text-[12px] text-muted select-all">
                {privateKey}
              </p>
              <button
                type="button"
                onClick={() => void copyKey()}
                className="flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
              >
                {keyCopied ? <Check size={13} /> : <Copy size={13} />}
                {keyCopied ? "Copied" : "Copy private key"}
              </button>
            </div>
          )}
          {disclosure}
        </div>
      ) : (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowKey(false);
                lock();
              }}
              className="rounded-xl bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
            >
              Lock key
            </button>
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="rounded-xl bg-surface-2 px-3.5 py-2 text-[12px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
            >
              {showKey ? "Hide backup" : "Back up key"}
            </button>
            <button
              type="button"
              onClick={forget}
              className="rounded-xl px-3.5 py-2 text-[12px] font-semibold text-faint ring-1 ring-transparent transition-colors hover:text-danger"
            >
              Forget
            </button>
          </div>
          {showKey && privateKey && (
            <div className="space-y-2 rounded-2xl bg-surface p-4 ring-1 ring-border">
              <p className="text-[12px] leading-relaxed text-warning">
                Anyone with this key controls the account. Copy it somewhere
                safe, then hide it.
              </p>
              <p className="break-all font-mono text-[12px] text-muted select-all">
                {privateKey}
              </p>
              <button
                type="button"
                onClick={() => void copyKey()}
                className="flex items-center gap-1.5 text-[12px] font-medium text-accent hover:underline"
              >
                {keyCopied ? <Check size={13} /> : <Copy size={13} />}
                {keyCopied ? "Copied" : "Copy private key"}
              </button>
            </div>
          )}
          {disclosure}
          <DiagnosticsRow />
        </div>
      )}

      <p className="mt-4 font-mono text-[11px] text-faint">
        {hasKey
          ? registered
            ? `registered · ${truncateAddress(address, 8, 6)} · ${network}`
            : `key loaded · ${truncateAddress(address ?? "", 8, 6)} · ${network}`
          : locked && hasStoredKey
            ? `locked · encrypted at rest · ${network}`
            : `no key · ${network}`}
        {paymaster !== "unknown" &&
          ` · sends via ${paymaster === "sponsored" ? "paymaster relay" : "self-pay"}`}
      </p>
    </section>
  );
}
