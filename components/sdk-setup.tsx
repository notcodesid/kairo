"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, KeyRound, Shield } from "@/components/icons";
import { addressUrl } from "@/lib/explorer";
import { truncateAddress } from "@/lib/format";
import { mainnetProverUrl, type SdkNetwork } from "@/lib/sdk";
import { useSdkStore } from "@/lib/sdk-store";
import { PrimaryButton } from "@/components/screens";

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
    setNetwork,
    generate,
    importKey,
    register,
  } = useSdkStore();
  const [importOpen, setImportOpen] = useState(false);
  const [importValue, setImportValue] = useState("");
  const [copied, setCopied] = useState(false);

  const hasKey = status === "ready" && address;
  const mainnetBlocked = network === "mainnet" && !mainnetProverUrl();

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

      {!hasKey ? (
        <div className="mt-5 space-y-3">
          <p className="text-[13px] leading-relaxed text-muted">
            No embedded key on {network} yet. Generate a fresh throwaway (fund
            it from a faucet), or import an existing test key. Throwaway keys
            only — never use real funds here.
          </p>
          {!importOpen ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex-1">
                <PrimaryButton busy={busy === "generate"} onClick={() => void generate()}>
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
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void importKey(importValue);
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
                className="h-13 w-full rounded-2xl bg-surface px-4 font-mono text-[13px] text-fg ring-1 ring-border transition-all placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
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
                  }}
                  className="flex h-13 items-center justify-center rounded-2xl bg-surface-2 px-5 text-[14px] font-semibold text-muted ring-1 ring-border transition-colors hover:text-fg"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          {error && <p className="text-[13px] text-danger">{error}</p>}
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
        </div>
      ) : null}

      <p className="mt-4 font-mono text-[11px] text-faint">
        {hasKey
          ? registered
            ? `registered · ${truncateAddress(address, 8, 6)} · ${network}`
            : `key loaded · ${truncateAddress(address ?? "", 8, 6)} · ${network}`
          : `no key · ${network}`}
      </p>
    </section>
  );
}
