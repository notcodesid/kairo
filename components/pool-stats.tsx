"use client";

import { useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
} from "@/components/icons";
import { POOL_ADDRESS, POOL_FEE_STRK } from "@/lib/chain";
import { addressUrl } from "@/lib/explorer";
import { truncateAddress } from "@/lib/format";

interface PoolStatsProps {
  shieldedBalance: number;
  publicBalance: number;
  isRegistered?: boolean;
}

export function PoolStats({
  shieldedBalance,
  publicBalance,
  isRegistered = true,
}: PoolStatsProps) {
  const [copied, setCopied] = useState(false);
  const total = shieldedBalance + publicBalance;
  const privacyRatio = total > 0 ? Math.round((shieldedBalance / total) * 100) : 0;

  function copyPool() {
    navigator.clipboard.writeText(POOL_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-4">
      {/* Privacy Health Card */}
      <div className="overflow-hidden rounded-3xl bg-surface p-6 ring-1 ring-border shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-fg">Privacy Shield Status</h4>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ${
            isRegistered
              ? "bg-surface-2 text-fg ring-border"
              : "bg-surface-2 text-muted ring-border"
          }`}>
            {isRegistered ? "Shield Active" : "Setup Required"}
          </span>
        </div>

        {/* Progress meter */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-[12px]">
            <span className="text-muted">Shielded Ratio</span>
            <span className="font-mono font-medium text-fg">{privacyRatio}% Confidential</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-border p-0.5">
            <div
              className="h-full rounded-full strk-pill-active transition-all duration-500"
              style={{ width: `${Math.max(privacyRatio, 6)}%` }}
            />
          </div>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          Funds inside the STRK20 pool are cryptographically shielded from block explorers, calldata indexers, and on-chain trackers.
        </p>
      </div>

      {/* STRK20 Privacy Pool Protocol Info */}
      <div className="rounded-3xl bg-surface p-6 ring-1 ring-border shadow-sm">
        <div className="flex items-center justify-between pb-3.5 border-b border-border">
          <span className="text-[13px] font-semibold text-fg">
            STRK20 Pool Specs
          </span>
          <a
            href={addressUrl(POOL_ADDRESS, "mainnet")}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] font-semibold text-fg hover:opacity-75 transition-opacity"
          >
            Voyager <ExternalLink size={11} />
          </a>
        </div>

        <div className="mt-3.5 space-y-3 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">Pool Contract</span>
            <button
              type="button"
              onClick={copyPool}
              className="group flex items-center gap-1.5 font-mono text-fg hover:text-muted transition-colors"
              title="Click to copy"
            >
              <span>{truncateAddress(POOL_ADDRESS, 6, 4)}</span>
              {copied ? <Check size={12} className="text-[#ff6122]" /> : <Copy size={12} className="opacity-60 group-hover:opacity-100" />}
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Proving Engine</span>
            <span className="font-medium text-fg">Cairo + Stwo STARKs</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Relayer Forwarder</span>
            <span className="font-medium text-fg flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#ff6122]" /> AVNU Paymaster (0%)
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Protocol Fee</span>
            <span className="font-mono font-medium text-fg">{POOL_FEE_STRK} STRK / action</span>
          </div>
        </div>
      </div>

      {/* Kairo Unlinkability Guarantee */}
      <div className="rounded-2xl bg-surface-2 p-4 ring-1 ring-border text-[12px] text-muted space-y-1.5">
        <div className="text-fg font-semibold flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-[#ff6122]" />
          <span>Zero Calldata Leakage</span>
        </div>
        <p className="leading-relaxed">
          Transactions are signed and submitted via rotating relayer networks. Your wallet address is never published in transaction payloads.
        </p>
      </div>
    </div>
  );
}
