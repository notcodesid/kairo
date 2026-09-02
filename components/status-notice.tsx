"use client";

import { useState } from "react";
import { Check, Shield, Spinner } from "@/components/icons";
import type { Strk20Support } from "@/lib/wallet-store";

/**
 * First-use onboarding for an unregistered user.
 */
export function SetupCard({
  walletName = "Ready",
  onCheck,
}: {
  walletName?: string;
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
    `Open your ${walletName} wallet extension`,
    "Perform your first Shield deposit (covers the STRK20 protocol fee)",
    "That initial shield creates and immutably registers your viewing key on-chain",
  ];

  return (
    <section className="overflow-hidden rounded-3xl bg-surface/90 p-6 ring-1 ring-border backdrop-blur-xl transition-all">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
          <Shield size={20} />
        </span>
        <div>
          <h2 className="text-[16px] font-bold text-fg">Activate Private Balances</h2>
          <p className="text-[12px] text-faint">One-time cryptographic viewing key registration</p>
        </div>
      </div>

      <ol className="mt-5 space-y-3">
        {steps.map((step, i) => (
          <li key={step} className="flex items-start gap-3 text-[13px] leading-relaxed text-muted">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-2 font-mono text-[11px] font-semibold text-accent ring-1 ring-border">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
        <button
          type="button"
          onClick={check}
          disabled={checking}
          className="flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-accent px-6 text-[14px] font-semibold text-bg transition-all hover:bg-accent-strong hover:shadow-[0_0_20px_rgba(157,140,255,0.3)] disabled:opacity-60"
        >
          {checking ? (
            <>
              <Spinner size={16} /> Verifying on-chain…
            </>
          ) : (
            <>
              <Check size={16} /> I&apos;ve Shielded — Verify Registration
            </>
          )}
        </button>

        {checkedOnce && !checking && (
          <p role="status" className="text-[12px] text-faint">
            Registration may take ~1 minute to finalize on Voyager.
          </p>
        )}
      </div>
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
    if (strk20 === "supported" || strk20 === "unregistered") {
      tone = "setup";
      text =
        "Testnet connected — private balances work here. Switch to Starknet Mainnet for live production use.";
    } else if (strk20 === "unknown") {
      tone = "info";
      text = "Checking private-balance support…";
    } else {
      text =
        "Testnet detected — this wallet only supports private balances on Starknet Mainnet. Switch networks in the wallet to continue.";
    }
  } else if (strk20 === "unknown") {
    tone = "info";
    text = "Checking STRK20 viewing key support…";
  } else if (strk20 === "unregistered") {
    tone = "setup";
    text = `One-time setup: open ${walletName ?? "Ready"} and shield any amount to activate your viewing key.`;
  } else {
    text = `${walletName ?? "This wallet"} does not support STRK20 private balances yet. Please use Ready wallet.`;
  }

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-2xl p-4 text-[13px] leading-relaxed ring-1 backdrop-blur-md ${
        tone === "problem"
          ? "bg-danger/10 text-danger ring-danger/25"
          : tone === "setup"
            ? "bg-accent/10 text-fg ring-accent/25"
            : "bg-surface/80 text-muted ring-border"
      }`}
    >
      {tone === "info" ? (
        <Spinner size={16} className="shrink-0 text-faint" />
      ) : (
        <Shield
          size={16}
          className={`shrink-0 ${tone === "setup" ? "text-accent" : "text-danger"}`}
        />
      )}
      <span>{text}</span>
    </div>
  );
}
