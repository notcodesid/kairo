"use client";

import { useState } from "react";
import { Check, Shield, Spinner } from "@/components/icons";
import type { Strk20Support } from "@/lib/wallet-store";

/**
 * First-use onboarding for an unregistered user. A dapp cannot generate or
 * register the viewing key itself — only the wallet can, during its own first
 * shield — so Kairo's implementation of "register on first use" is detection
 * (the probe) + this guided flow + re-probe confirmation.
 */
export function SetupCard({
  walletName = "Ready",
  onCheck,
}: {
  walletName?: string;
  /** Re-run the probe. Resolves when state is refreshed. */
  onCheck: () => Promise<void>;
}) {
  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  async function check() {
    setChecking(true);
    try {
      await onCheck();
      setCheckedOnce(true);
    } finally {
      setChecking(false);
    }
  }

  const steps = [
    `Open the ${walletName} extension`,
    "Shield any amount there (10+ STRK covers the fee)",
    "That first shield creates and registers your private viewing key",
  ];

  return (
    <section className="flex flex-col gap-4 rounded-card bg-surface px-5 py-5 ring-1 ring-border">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-accent ring-1 ring-border">
          <Shield size={17} />
        </span>
        <div>
          <h2 className="text-[15px] font-semibold">Turn on private balances</h2>
          <p className="text-[12px] text-faint">One-time setup, done inside {walletName}</p>
        </div>
      </div>

      <ol className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-2.5 text-[13px] leading-5 text-muted">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] text-accent ring-1 ring-border">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <button
        type="button"
        onClick={check}
        disabled={checking}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-accent text-[14px] font-semibold text-bg transition-colors duration-150 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-60"
      >
        {checking ? (
          <>
            <Spinner size={16} /> Checking…
          </>
        ) : (
          <>
            <Check size={16} /> I've shielded — check again
          </>
        )}
      </button>

      {checkedOnce && !checking && (
        <p role="status" className="text-center text-[12px] leading-5 text-faint">
          Not seeing it yet? The registration can take a minute to confirm —
          try again shortly.
        </p>
      )}
    </section>
  );
}

export function StatusNotice({
  isMainnet,
  strk20,
  walletName,
}: {
  isMainnet: boolean;
  strk20: Strk20Support;
  walletName?: string;
}) {
  let text: string;
  let tone: "info" | "setup" | "problem" = "problem";

  if (!isMainnet) {
    // Show the probe result even on testnet — it tells the user (and us)
    // whether this wallet exposes the STRK20 API on this network at all.
    if (strk20 === "supported" || strk20 === "unregistered") {
      tone = "setup";
      text =
        "Testnet detected — private balances work here. Switch to Starknet Mainnet for real use.";
    } else if (strk20 === "unknown") {
      tone = "info";
      text = "Testnet detected — checking private-balance support…";
    } else {
      text =
        "Testnet detected — this wallet only supports private balances on Starknet Mainnet. Switch networks in the wallet to continue.";
    }
  } else if (strk20 === "unknown") {
    tone = "info";
    text = "Checking private-balance support…";
  } else if (strk20 === "unregistered") {
    // There is no dapp-side register call — the wallet registers the viewing
    // key on the user's first in-wallet shield.
    tone = "setup";
    text = `One-time setup: open ${walletName ?? "Ready"} and shield any amount — that turns on your private balance. Then come back here.`;
  } else {
    text = `${walletName ?? "This wallet"} doesn't support private balances yet. Install Ready to go private.`;
  }

  return (
    <p
      role="status"
      className="flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-3 text-[13px] leading-5 text-muted ring-1 ring-border"
    >
      {tone === "info" ? (
        <Spinner size={14} className="shrink-0 text-faint" />
      ) : (
        <Shield
          size={14}
          className={`shrink-0 ${tone === "setup" ? "text-accent" : "text-danger"}`}
        />
      )}
      {text}
    </p>
  );
}
