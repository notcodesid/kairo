"use client";

import {
  ExternalLink,
} from "@/components/icons";
import { POOL_ADDRESS, POOL_FEE_STRK } from "@/lib/chain";
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
  const total = shieldedBalance + publicBalance;
  const privacyRatio = total > 0 ? Math.round((shieldedBalance / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Privacy Health Card */}
      <div className="overflow-hidden rounded-3xl bg-surface p-5 ring-1 ring-border shadow-sm transition-all">
        <div className="flex items-center justify-between">
          <h4 className="text-[13px] font-semibold text-fg">Privacy Shield Status</h4>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-fg ring-1 ring-border">
            {isRegistered ? "100% Shielded" : "Setup Required"}
          </span>
        </div>

        {/* Progress meter */}
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-[12px]">
            <span className="text-muted">Shielded Ratio</span>
            <span className="font-mono font-medium text-fg">{privacyRatio}% Private</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2 ring-1 ring-border">
            <div
              className="h-full rounded-full bg-black transition-all duration-500"
              style={{ width: `${Math.max(privacyRatio, 6)}%` }}
            />
          </div>
        </div>

        <p className="mt-3 text-[12px] leading-5 text-muted">
          Funds in the STRK20 privacy pool are hidden from blockchain explorers, calldata indexers, and third parties.
        </p>
      </div>

      {/* STRK20 Privacy Pool Protocol Info */}
      <div className="rounded-3xl bg-surface p-5 ring-1 ring-border shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <span className="text-[13px] font-semibold text-fg">
            STRK20 Pool Specs
          </span>
          <a
            href={`https://voyager.online/contract/${POOL_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] font-semibold text-fg hover:underline"
          >
            Pool on Voyager <ExternalLink size={11} />
          </a>
        </div>

        <div className="mt-3 space-y-2.5 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="text-muted">Pool Contract</span>
            <span className="font-mono text-fg">{truncateAddress(POOL_ADDRESS, 8, 6)}</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Proving Engine</span>
            <span className="font-medium text-fg">Cairo + Stwo STARKs</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Relayer Forwarder</span>
            <span className="font-medium text-fg flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-black" /> AVNU Paymaster
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-muted">Protocol Fee</span>
            <span className="font-mono font-medium text-fg">{POOL_FEE_STRK} STRK / action</span>
          </div>
        </div>
      </div>

      {/* Umbra Unlinkability Guarantee */}
      <div className="rounded-2xl bg-surface-2 p-4 ring-1 ring-border text-[12px] text-muted space-y-1.5">
        <div className="text-fg font-semibold">
          <span>Zero Calldata Leakage</span>
        </div>
        <p className="leading-relaxed">
          Transactions are signed and submitted via rotating relayers. Your wallet address is never published in transaction payloads.
        </p>
      </div>
    </div>
  );
}
