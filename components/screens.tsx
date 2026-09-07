"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import QRCode from "react-qr-code";
import { validateAndParseAddress } from "starknet";
import {
  Check,
  Copy,
  ExternalLink,
  Spinner,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
} from "@/components/icons";
import { txUrl } from "@/lib/explorer";
import { formatAmount, splitAmount, truncateAddress } from "@/lib/format";
import type { ActivityItem } from "@/lib/mock";
import { isNotRegisteredError } from "@/lib/wallet-store";

/* ---------------------------------------------------------------- Shared UI */

export function PrimaryButton({
  children,
  busy,
  disabled,
  onClick,
  type = "button",
  variant = "accent",
}: {
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "accent" | "surface" | "emerald";
}) {
  const bg =
    variant === "surface"
      ? "bg-surface-2 hover:bg-zinc-200 text-fg ring-1 ring-border"
      : "btn-strk20 text-white";

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      whileHover={{ scale: disabled || busy ? 1 : 1.01 }}
      whileTap={{ scale: disabled || busy ? 1 : 0.985 }}
      transition={{ type: "spring", stiffness: 450, damping: 25 }}
      className={`flex h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 text-[16px] font-semibold transition-all duration-150 focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed ${bg}`}
    >
      {busy && <Spinner size={18} />}
      {children}
    </motion.button>
  );
}

export function DoneModal({
  title,
  detail,
  txHash,
  onDone,
}: {
  title: string;
  detail: string;
  txHash?: string;
  onDone: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyHash() {
    if (!txHash) return;
    try {
      await navigator.clipboard?.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  // Celebratory micro-burst particles
  const particles = [
    { x: -40, y: -30, r: 3, delay: 0.18 },
    { x: 42, y: -26, r: 3.5, delay: 0.22 },
    { x: -46, y: 16, r: 2.5, delay: 0.2 },
    { x: 46, y: 18, r: 3, delay: 0.26 },
    { x: -18, y: -44, r: 2, delay: 0.15 },
    { x: 22, y: -42, r: 2.5, delay: 0.28 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center justify-center gap-6 py-8 text-center"
    >
      {/* Animated Success Icon with Concentric Ripples & Burst */}
      <div className="relative flex items-center justify-center">
        {/* Expanding ripple ring 1 */}
        <motion.span
          initial={{ scale: 0.7, opacity: 0.75 }}
          animate={{ scale: 1.75, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.1 }}
          className="absolute size-20 rounded-full border border-fg/25"
        />

        {/* Expanding ripple ring 2 */}
        <motion.span
          initial={{ scale: 0.7, opacity: 0.5 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.4 }}
          className="absolute size-20 rounded-full border border-fg/15"
        />

        {/* Burst particles */}
        {particles.map((p, i) => (
          <motion.span
            key={i}
            initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
            animate={{
              scale: [0, 1.2, 0],
              x: p.x,
              y: p.y,
              opacity: [0, 0.85, 0],
            }}
            transition={{
              duration: 0.85,
              ease: [0.16, 1, 0.3, 1],
              delay: p.delay,
            }}
            style={{ width: p.r * 2, height: p.r * 2 }}
            className="absolute rounded-full bg-fg"
          />
        ))}

        {/* Main Spring Badge */}
        <motion.div
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{
            type: "spring",
            stiffness: 420,
            damping: 22,
            delay: 0.06,
          }}
          className="relative z-10 flex size-20 items-center justify-center rounded-3xl bg-fg text-bg shadow-[0_12px_28px_rgba(0,0,0,0.18)] ring-1 ring-border"
        >
          <svg
            width="34"
            height="34"
            viewBox="0 0 24 24"
            fill="none"
            className="text-bg"
          >
            <motion.path
              d="M5 13l4.5 4.5L19 7.5"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{
                duration: 0.42,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.22,
              }}
            />
          </svg>
        </motion.div>
      </div>

      {/* Header Info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="space-y-2 max-w-md mx-auto"
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[11px] font-semibold text-fg ring-1 ring-border">
          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Confirmed on Starknet</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">{title}</h2>
        <p className="text-[14px] leading-relaxed text-muted">{detail}</p>
      </motion.div>

      {/* Transaction Receipt Box */}
      {txHash && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface-2 p-1.5 ring-1 ring-border"
        >
          <button
            type="button"
            onClick={copyHash}
            className="flex h-9 items-center gap-2 rounded-xl bg-surface px-3 font-mono text-[12px] font-medium text-fg ring-1 ring-border transition-all hover:bg-surface-2 active:scale-98 cursor-pointer"
            title="Copy transaction hash"
          >
            <span>{truncateAddress(txHash, 10, 8)}</span>
            {copied ? (
              <span className="flex items-center gap-1 text-fg font-bold text-[11px]">
                <Check size={13} className="text-fg" /> Copied
              </span>
            ) : (
              <Copy size={13} className="text-muted" />
            )}
          </button>
          <a
            href={txUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-semibold text-fg transition-colors hover:bg-surface hover:underline"
          >
            <span>Voyager</span>
            <ExternalLink size={12} className="text-muted" />
          </a>
        </motion.div>
      )}

      {/* Return Action Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-xs pt-1"
      >
        <PrimaryButton onClick={onDone}>Return to App</PrimaryButton>
      </motion.div>
    </motion.div>
  );
}

function friendlyError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  if (/reject|declin|denied|abort|cancel/i.test(msg)) {
    return "Transaction was declined in the wallet.";
  }
  if (isNotRegisteredError(err)) {
    return "Private balances aren’t activated yet. Open Ready and complete one Shield there — that registers your viewing key. Then return here and try again.";
  }
  return msg;
}

/* ----------------------------------------------------------- Dashboard Tab */

interface DashboardTabProps {
  shielded: number;
  publicBalance: number;
  pending: number;
  token: string;
  address: string;
  activity: ActivityItem[];
  onNavigate: (tab: "shield" | "transfer" | "swap" | "unshield" | "receive" | "activity") => void;
  showSetup?: boolean;
}

export function DashboardTab({
  shielded,
  publicBalance,
  pending,
  token,
  activity,
  onNavigate,
}: DashboardTabProps) {
  const [hideBalances, setHideBalances] = useState(false);
  const { int: sInt, frac: sFrac } = splitAmount(shielded);

  const total = shielded + publicBalance;
  const privateRatio = total > 0 ? Math.round((shielded / total) * 100) : 0;
  const tokenRate = token === "ETH" ? 2500 : token === "USDC" ? 1 : 0.42;
  const usdValue = (shielded * tokenRate).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-6">
      {/* Signature Asset & Privacy Hero Card */}
      <div className="relative overflow-hidden rounded-3xl bg-surface p-6 sm:p-8 ring-1 ring-border shadow-sm transition-all">
        {/* Top Header Status & Privacy Visibility Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#ff6122] animate-pulse" />
            <span className="text-[12px] font-semibold text-fg">
              Zero-Knowledge Pool Active
            </span>
          </div>

          <button
            type="button"
            onClick={() => setHideBalances((h) => !h)}
            className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-[11px] font-medium text-muted hover:text-fg ring-1 ring-border transition-colors"
          >
            {hideBalances ? (
              <>
                <Eye size={12} />
                <span>Show</span>
              </>
            ) : (
              <>
                <EyeOff size={12} />
                <span>Hide</span>
              </>
            )}
          </button>
        </div>

        {/* Hero Balance Metric */}
        <div className="mt-5 space-y-1">
          <p className="text-[12px] font-semibold text-muted uppercase tracking-wider">
            Confidential Shielded Balance
          </p>
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-4xl sm:text-6xl font-bold tracking-tight text-fg tabular-nums">
              {hideBalances ? "••••••" : sInt}
              {!hideBalances && sFrac && <span className="text-muted">.{sFrac}</span>}
            </span>
            <span className="text-xl sm:text-2xl font-semibold text-muted">{token}</span>
          </div>
          <p className="text-[13px] font-mono text-muted">
            {hideBalances ? "≈ $•••• USD" : `≈ $${usdValue} USD`}
          </p>
        </div>

        {/* Segmented Privacy Allocation Bar */}
        <div className="mt-6 rounded-2xl bg-surface-2 p-4 ring-1 ring-border space-y-3">
          <div className="flex items-center justify-between text-[12px]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#ff6122]" />
              <span className="font-semibold text-fg">Private:</span>
              <span className="font-mono font-medium text-fg">
                {hideBalances ? "••••" : formatAmount(shielded)} {token} ({privateRatio}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-border-strong" />
              <span className="text-muted">Public:</span>
              <span className="font-mono text-muted">
                {hideBalances ? "••••" : formatAmount(publicBalance)} {token}
              </span>
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-border flex">
            <div
              className="h-full rounded-full strk-pill-active transition-all duration-500"
              style={{ width: `${Math.max(privateRatio, total === 0 ? 0 : 4)}%` }}
            />
          </div>
        </div>

        {/* Pending Note Maturity Notice */}
        {pending > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-2.5 text-[12px] text-muted ring-1 ring-border">
            <span className="size-2 rounded-full bg-[#ff6122] animate-ping" />
            <span>+{formatAmount(pending)} {token} confirming note maturity (~5m)</span>
          </div>
        )}

        {/* Contextual Action Shortcuts */}
        <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <button
            type="button"
            onClick={() => onNavigate("shield")}
            className="flex items-center justify-center gap-2 rounded-xl strk-pill-active px-4 py-3 text-[13px] font-semibold text-white shadow-sm transition-all hover:opacity-90"
          >
            <ShieldCheck size={15} />
            <span>Shield Funds</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("transfer")}
            className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[13px] font-semibold text-fg ring-1 ring-border transition-all hover:bg-zinc-200 dark:hover:bg-zinc-800"
          >
            <ArrowUpRight size={15} />
            <span>Private Send</span>
          </button>
          {/* Private Swap hidden: no swap execution exists yet (see NAV_TABS). */}
          <button
            type="button"
            onClick={() => onNavigate("unshield")}
            className="flex items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-[13px] font-semibold text-muted ring-1 ring-border transition-all hover:bg-zinc-200 hover:text-fg dark:hover:bg-zinc-800"
          >
            <ArrowDownLeft size={15} />
            <span>Unshield</span>
          </button>
        </div>
      </div>

      {/* Confidential Activity Ledger */}
      <div className="rounded-3xl bg-surface p-6 sm:p-7 ring-1 ring-border shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div>
            <h3 className="text-[15px] font-semibold text-fg">Confidential Activity</h3>
            <p className="text-[12px] text-muted mt-0.5">Session history and verified zero-knowledge notes</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("activity")}
            className="text-[12px] font-semibold text-fg hover:opacity-75 transition-opacity"
          >
            View History →
          </button>
        </div>

        {activity.length > 0 ? (
          <ul className="mt-3 divide-y divide-border">
            {activity.slice(0, 4).map((item) => (
              <li key={item.id} className="py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 ring-1 ring-border text-fg">
                    {item.kind === "sent" ? (
                      <ArrowUpRight size={15} />
                    ) : item.kind === "received" ? (
                      <ArrowDownLeft size={15} />
                    ) : (
                      <ShieldCheck size={15} />
                    )}
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-fg capitalize">
                      {item.kind === "sent" ? "Private Transfer" : item.kind === "received" ? "Private Receive" : `${item.kind} Assets`}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">{item.at}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono text-[14px] font-semibold text-fg tabular-nums">
                    {item.kind === "sent" ? "-" : "+"}
                    {formatAmount(item.amount)} {token}
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold text-fg ring-1 ring-border mt-0.5">
                    <span className="size-1 rounded-full bg-[#ff6122]" />
                    Zero calldata
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-10 text-center text-muted space-y-1">
            <p className="text-[13px] font-medium text-fg">No activity in current session</p>
            <p className="text-[12px]">Your historical balance notes and cryptographic nullifiers remain private.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Shield Tab */

// STRK-only: every submit path (wallet + SDK, fee included) is hardcoded to
// STRK.address, so offering other tokens would label a STRK movement as USDC.
// Reintroduce options only with real per-token discovery + execution.
const AVAILABLE_TOKENS = [
  { symbol: "STRK", name: "Starknet Token", rate: 0.42 },
];

export function TokenSelectModal({
  open,
  onClose,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  selected: string;
  onSelect: (token: string) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 450, damping: 28 }}
            className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-border"
          >
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <h3 className="text-[16px] font-bold text-fg">Select Token</h3>
              <button
                type="button"
                onClick={onClose}
                className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-fg text-sm font-semibold"
              >
                ✕
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {AVAILABLE_TOKENS.map((t) => {
                const isCurrent = t.symbol === selected;
                return (
                  <button
                    key={t.symbol}
                    type="button"
                    onClick={() => onSelect(t.symbol)}
                    className={`flex w-full items-center justify-between rounded-2xl p-3.5 transition-all ${
                      isCurrent
                        ? "bg-surface-2 text-fg ring-1 ring-border-strong"
                        : "hover:bg-surface-2 text-fg"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-9 items-center justify-center rounded-full bg-surface-2 font-bold text-[13px] text-fg">
                        {t.symbol[0]}
                      </span>
                      <div className="text-left">
                        <p className="text-[14px] font-semibold">{t.symbol}</p>
                        <p className="text-[12px] text-muted">{t.name}</p>
                      </div>
                    </div>
                    {isCurrent && <span className="text-fg font-bold text-sm">✓</span>}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export function ShieldTab({
  publicBalance,
  token = "STRK",
  feeStrk = 0,
  onShield,
  connected = true,
  onConnect,
}: {
  publicBalance: number;
  token: string;
  feeStrk?: number;
  onShield?: (amount: number) => Promise<string | void>;
  connected?: boolean;
  onConnect?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(token);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [done, setDone] = useState<{ amount: number; txHash?: string }>({ amount: 0 });

  const numAmount = Number(amount) || 0;
  const tokenPrice = selectedToken === "ETH" ? 2500 : selectedToken === "USDC" ? 1 : 0.42;
  const usdValue = (numAmount * tokenPrice).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected) {
      onConnect?.();
      return;
    }
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setError("Please enter a valid amount to shield.");
      return;
    }
    if (value > publicBalance) {
      setError(`Insufficient balance. You have ${formatAmount(publicBalance)} ${selectedToken}.`);
      return;
    }

    setError(undefined);
    setPhase("submitting");
    try {
      const res = await (onShield
        ? onShield(value)
        : new Promise<void>((r) => setTimeout(r, 1200)));
      setDone({ amount: value, txHash: typeof res === "string" ? res : undefined });
      setPhase("done");
    } catch (err) {
      setError(friendlyError(err));
      setPhase("form");
    }
  }

  if (phase === "done") {
    return (
      <DoneModal
        title="Funds Shielded into Pool"
        detail={`${formatAmount(done.amount)} ${selectedToken} has been successfully deposited into the STRK20 privacy pool. It becomes spendable in private notes within ~5 minutes.`}
        txHash={done.txHash}
        onDone={() => {
          setPhase("form");
          setAmount("");
        }}
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <div className="max-w-[460px] mx-auto rounded-[32px] bg-white p-4 sm:p-5 border border-[#e4e7ec] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Top Input Box */}
        <div className="rounded-[24px] border border-[#e4e7ec] bg-[#fcfdfd] p-5 space-y-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-border-strong focus-within:border-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-[13px] sm:text-[14px] font-semibold text-fg">
              You&apos;re Shielding
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setError(undefined);
                setAmount(e.target.value.replace(/[^0-9.]/g, ""));
              }}
              disabled={busy}
              className="w-full bg-transparent font-normal text-4xl sm:text-5xl text-fg outline-none placeholder:text-[#98a2b3]"
            />

            {/* Token Selector Pill */}
            <button
              type="button"
              onClick={() => setTokenModalOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#eef2f6] hover:bg-[#e2e8f0] px-3.5 py-1.5 text-[13px] font-medium text-fg cursor-pointer transition-colors"
            >
              <span>{selectedToken}</span>
              <span className="text-[11px] text-muted">↕</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[13px] text-muted">
            <div className="flex items-center gap-1">
              <span className="text-[11px]">↓↑</span>
              <span>{usdValue}</span>
            </div>
            <div>
              Balance: <span className="font-mono text-fg">{formatAmount(publicBalance)}</span> ·{" "}
              <button
                type="button"
                onClick={() => setAmount(String(publicBalance))}
                className="font-medium text-fg hover:text-fg transition-colors"
              >
                Max
              </button>
            </div>
          </div>
        </div>

        {/* Shielding Fee Container */}
        <div className="rounded-[20px] border border-[#e4e7ec] bg-white px-5 py-4 flex items-center justify-between text-[14px] shadow-sm">
          <span className="text-muted font-medium">Shielding Fee</span>
          <span className="text-fg font-medium">No Fee · $0.00</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Action Button */}
        {!connected ? (
          <PrimaryButton type="button" onClick={onConnect}>
            Get Started
          </PrimaryButton>
        ) : (
          <PrimaryButton type="submit" busy={busy}>
            {busy ? "Shielding Funds…" : "Get Started"}
          </PrimaryButton>
        )}
      </form>

      <TokenSelectModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        selected={selectedToken}
        onSelect={(t) => {
          setSelectedToken(t);
          setTokenModalOpen(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ Transfer Tab */

export function TransferTab({
  spendable,
  token = "STRK",
  feeStrk = 0,
  onSubmit,
  checkRecipient,
  connected = true,
  onConnect,
}: {
  spendable: number;
  token: string;
  feeStrk?: number;
  onSubmit?: (recipient: string, amount: number) => Promise<string | void>;
  checkRecipient?: (recipient: string) => Promise<boolean | undefined>;
  connected?: boolean;
  onConnect?: () => void;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(token);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [errors, setErrors] = useState<{ recipient?: string; amount?: string }>({});
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [recipientValid, setRecipientValid] = useState<boolean | null>(null);
  const [checkingRecipient, setCheckingRecipient] = useState(false);
  const [sent, setSent] = useState<{ amount: number; recipient: string; txHash?: string }>({
    amount: 0,
    recipient: "",
  });

  const numAmount = Number(amount) || 0;
  const tokenPrice = selectedToken === "ETH" ? 2500 : selectedToken === "USDC" ? 1 : 0.42;
  const usdValue = (numAmount * tokenPrice).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  async function handleRecipientBlur() {
    const trimmed = recipient.trim();
    if (!trimmed || !checkRecipient) {
      setRecipientValid(null);
      return;
    }
    let parsed = "";
    try {
      parsed = validateAndParseAddress(trimmed);
    } catch {
      setRecipientValid(null);
      return;
    }

    setCheckingRecipient(true);
    try {
      const ok = await checkRecipient(parsed);
      setRecipientValid(ok ?? null);
    } catch {
      setRecipientValid(null);
    } finally {
      setCheckingRecipient(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected) {
      onConnect?.();
      return;
    }
    const next: typeof errors = {};

    let parsedRecipient = "";
    try {
      parsedRecipient = validateAndParseAddress(recipient.trim());
    } catch {
      next.recipient = "Invalid Starknet address format.";
    }

    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      next.amount = "Enter a valid amount to send.";
    } else if (value > spendable) {
      next.amount = `Max sendable is ${formatAmount(spendable)} ${selectedToken}.`;
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPhase("submitting");
    try {
      if (checkRecipient) {
        const ok = await checkRecipient(parsedRecipient);
        if (ok === false) {
          setErrors({
            recipient: "Recipient has no registered STRK20 viewing key yet.",
          });
          setPhase("form");
          return;
        }
      }

      const res = await (onSubmit
        ? onSubmit(parsedRecipient, value)
        : new Promise<void>((r) => setTimeout(r, 1200)));
      setSent({
        amount: value,
        recipient: parsedRecipient,
        txHash: typeof res === "string" ? res : undefined,
      });
      setPhase("done");
    } catch (err) {
      setErrors({ amount: friendlyError(err) });
      setPhase("form");
    }
  }

  if (phase === "done") {
    return (
      <DoneModal
        title="Private Transfer Executed"
        detail={`${formatAmount(sent.amount)} ${selectedToken} has been privately routed through the STRK20 pool to ${truncateAddress(sent.recipient)}. Zero sender linkage exists on-chain.`}
        txHash={sent.txHash}
        onDone={() => {
          setPhase("form");
          setAmount("");
          setRecipient("");
        }}
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <div className="max-w-[460px] mx-auto rounded-[32px] bg-white p-4 sm:p-5 border border-[#e4e7ec] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Top Input Box */}
        <div className="rounded-[24px] border border-[#e4e7ec] bg-[#fcfdfd] p-5 space-y-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-border-strong focus-within:border-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-[13px] sm:text-[14px] font-semibold text-fg">
              You&apos;re Sending
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setErrors((prev) => ({ ...prev, amount: undefined }));
                setAmount(e.target.value.replace(/[^0-9.]/g, ""));
              }}
              disabled={busy}
              className="w-full bg-transparent font-normal text-4xl sm:text-5xl text-fg outline-none placeholder:text-[#98a2b3]"
            />

            {/* Token Selector Pill */}
            <button
              type="button"
              onClick={() => setTokenModalOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#eef2f6] hover:bg-[#e2e8f0] px-3.5 py-1.5 text-[13px] font-medium text-fg cursor-pointer transition-colors"
            >
              <span>{selectedToken}</span>
              <span className="text-[11px] text-muted">↕</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[13px] text-muted">
            <div className="flex items-center gap-1">
              <span className="text-[11px]">↓↑</span>
              <span>{usdValue}</span>
            </div>
            <div>
              Shielded: <span className="font-mono text-fg">{formatAmount(spendable)}</span> ·{" "}
              <button
                type="button"
                onClick={() => setAmount(String(spendable))}
                className="font-medium text-fg hover:text-fg transition-colors"
              >
                Max
              </button>
            </div>
          </div>
        </div>

        {/* Recipient Address Box */}
        <div className="rounded-[20px] border border-[#e4e7ec] bg-white p-4 space-y-1.5 shadow-sm">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-semibold text-fg">Recipient Address</span>
            {checkingRecipient ? (
              <span className="text-[11px] text-muted">Checking key…</span>
            ) : recipientValid === true ? (
              <span className="text-[11px] text-[#2ca01c] font-semibold">Viewing key registered</span>
            ) : null}
          </div>
          <input
            type="text"
            placeholder="0x… or Starknet ID"
            value={recipient}
            onChange={(e) => {
              setErrors((prev) => ({ ...prev, recipient: undefined }));
              setRecipient(e.target.value);
            }}
            onBlur={handleRecipientBlur}
            disabled={busy}
            className="w-full bg-transparent font-mono text-[13px] text-fg outline-none placeholder:text-muted"
          />
        </div>

        {/* Transfer Fee Container */}
        <div className="rounded-[18px] border border-[#e4e7ec] bg-white px-5 py-4 flex items-center justify-between text-[14px] shadow-sm">
          <span className="text-muted font-medium">Transfer Fee</span>
          <span className="text-fg font-medium">No Fee · $0.00</span>
        </div>

        {errors.recipient && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            {errors.recipient}
          </div>
        )}
        {errors.amount && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            {errors.amount}
          </div>
        )}

        {/* Action Button */}
        {!connected ? (
          <PrimaryButton type="button" onClick={onConnect}>
            Get Started
          </PrimaryButton>
        ) : (
          <PrimaryButton type="submit" busy={busy}>
            {busy ? "Sending Privately…" : "Get Started"}
          </PrimaryButton>
        )}
      </form>

      <TokenSelectModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        selected={selectedToken}
        onSelect={(t) => {
          setSelectedToken(t);
          setTokenModalOpen(false);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------- Swap Tab */

export function SwapTab({
  spendable,
  token = "STRK",
  feeStrk = 0,
  connected = true,
  onConnect,
  onSwap,
}: {
  spendable: number;
  token?: string;
  feeStrk?: number;
  connected?: boolean;
  onConnect?: () => void;
  onSwap?: (fromAmount: number, fromToken: string, toToken: string) => Promise<string | void>;
}) {
  const [amount, setAmount] = useState("");
  const [fromToken, setFromToken] = useState("STRK");
  const [toToken, setToToken] = useState("USDC");
  const [tokenModalTarget, setTokenModalTarget] = useState<"from" | "to" | null>(null);
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [done, setDone] = useState<{ amount: number; toAmount: number; txHash?: string }>({
    amount: 0,
    toAmount: 0,
  });

  const rate = useMemo(() => {
    if (fromToken === "STRK" && toToken === "USDC") return 0.42;
    if (fromToken === "USDC" && toToken === "STRK") return 2.38;
    if (fromToken === "STRK" && toToken === "ETH") return 0.00017;
    if (fromToken === "ETH" && toToken === "STRK") return 5900;
    if (fromToken === "ETH" && toToken === "USDC") return 2500;
    if (fromToken === "USDC" && toToken === "ETH") return 0.0004;
    return 1;
  }, [fromToken, toToken]);

  const numAmount = parseFloat(amount) || 0;
  const estimatedReceive = numAmount > 0 ? (numAmount * rate).toFixed(4) : "0";
  const usdValue = (numAmount * (fromToken === "ETH" ? 2500 : fromToken === "USDC" ? 1 : 0.42)).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected) {
      onConnect?.();
      return;
    }
    if (!numAmount || numAmount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (numAmount > spendable) {
      setError(`Amount exceeds shielded balance (${formatAmount(spendable)} ${fromToken}).`);
      return;
    }
    setError(undefined);
    setPhase("submitting");

    try {
      const res = await (onSwap
        ? onSwap(numAmount, fromToken, toToken)
        : new Promise<void>((r) => setTimeout(r, 1400)));
      setDone({
        amount: numAmount,
        toAmount: parseFloat(estimatedReceive),
        txHash: typeof res === "string" ? res : undefined,
      });
      setPhase("done");
    } catch (err) {
      setError(friendlyError(err));
      setPhase("form");
    }
  }

  if (phase === "done") {
    return (
      <DoneModal
        title="Private Swap Completed"
        detail={`Successfully swapped ${formatAmount(done.amount)} ${fromToken} for ~${formatAmount(done.toAmount)} ${toToken} inside the privacy pool.`}
        txHash={done.txHash}
        onDone={() => {
          setPhase("form");
          setAmount("");
        }}
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <div className="max-w-[460px] mx-auto rounded-[32px] bg-white p-4 sm:p-5 border border-[#e4e7ec] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* You're Swapping Container */}
        <div className="rounded-[24px] border border-[#e4e7ec] bg-[#fcfdfd] p-5 space-y-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-border-strong focus-within:border-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-[13px] sm:text-[14px] font-semibold text-fg">
              You&apos;re Swapping
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setError(undefined);
                setAmount(e.target.value.replace(/[^0-9.]/g, ""));
              }}
              disabled={busy}
              className="w-full bg-transparent font-normal text-4xl sm:text-5xl text-fg outline-none placeholder:text-[#98a2b3]"
            />

            {/* Token Selector Pill */}
            <button
              type="button"
              onClick={() => setTokenModalTarget("from")}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#eef2f6] hover:bg-[#e2e8f0] px-3.5 py-1.5 text-[13px] font-medium text-fg cursor-pointer transition-colors"
            >
              <span>{fromToken}</span>
              <span className="text-[11px] text-muted">↕</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[13px] text-muted">
            <div className="flex items-center gap-1">
              <span className="text-[11px]">↓↑</span>
              <span>{usdValue}</span>
            </div>
            <div>
              Balance: <span className="font-mono text-fg">{formatAmount(spendable)}</span> ·{" "}
              <button
                type="button"
                onClick={() => setAmount(String(spendable))}
                className="font-medium text-fg hover:text-fg transition-colors"
              >
                Max
              </button>
            </div>
          </div>
        </div>

        {/* Swap Flip Button */}
        <div className="flex items-center justify-center -my-1">
          <motion.button
            type="button"
            whileHover={{ scale: 1.15, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 350, damping: 18 }}
            onClick={() => {
              const temp = fromToken;
              setFromToken(toToken);
              setToToken(temp);
            }}
            className="flex size-9 items-center justify-center rounded-full bg-white border border-[#e4e7ec] text-fg shadow-sm hover:bg-[#eef2f6] text-[14px]"
            title="Switch tokens"
          >
            ⇅
          </motion.button>
        </div>

        {/* You Receive Container */}
        <div className="rounded-[24px] border border-[#e4e7ec] bg-white p-5 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[13px] sm:text-[14px] font-semibold text-fg">
              You Receive (Estimated)
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="w-full bg-transparent font-normal text-4xl sm:text-5xl text-fg">
              {numAmount > 0 ? estimatedReceive : "0"}
            </div>

            {/* Token Selector Pill */}
            <button
              type="button"
              onClick={() => setTokenModalTarget("to")}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#eef2f6] hover:bg-[#e2e8f0] px-3.5 py-1.5 text-[13px] font-medium text-fg cursor-pointer transition-colors"
            >
              <span>{toToken}</span>
              <span className="text-[11px] text-muted">↕</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[13px] text-muted">
            <span>Rate: 1 {fromToken} ≈ {rate} {toToken}</span>
            <span className="text-fg font-medium">AVNU DEX</span>
          </div>
        </div>

        {/* Swap Fee Container */}
        <div className="rounded-[18px] border border-[#e4e7ec] bg-white px-5 py-4 flex items-center justify-between text-[14px] shadow-sm">
          <span className="text-muted font-medium">Swap Fee</span>
          <span className="text-fg font-medium">No Fee · $0.00</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Action Button */}
        {!connected ? (
          <PrimaryButton type="button" onClick={onConnect}>
            Get Started
          </PrimaryButton>
        ) : (
          <PrimaryButton type="submit" busy={busy}>
            {busy ? "Swapping Privately…" : "Get Started"}
          </PrimaryButton>
        )}
      </form>

      <TokenSelectModal
        open={tokenModalTarget !== null}
        onClose={() => setTokenModalTarget(null)}
        selected={tokenModalTarget === "from" ? fromToken : toToken}
        onSelect={(t) => {
          if (tokenModalTarget === "from") setFromToken(t);
          else setToToken(t);
          setTokenModalTarget(null);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ Unshield Tab */

export function UnshieldTab({
  shieldedBalance,
  token = "STRK",
  feeStrk = 0,
  onUnshield,
  connected = true,
  onConnect,
}: {
  shieldedBalance: number;
  token?: string;
  feeStrk?: number;
  onUnshield?: (amount: number) => Promise<string | void>;
  connected?: boolean;
  onConnect?: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState(token);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [done, setDone] = useState<{ amount: number; txHash?: string }>({ amount: 0 });

  const numAmount = Number(amount) || 0;
  const tokenPrice = selectedToken === "ETH" ? 2500 : selectedToken === "USDC" ? 1 : 0.42;
  const usdValue = (numAmount * tokenPrice).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connected) {
      onConnect?.();
      return;
    }
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setError("Please enter an amount to unshield.");
      return;
    }
    if (value > shieldedBalance) {
      setError(`Max unshieldable is ${formatAmount(shieldedBalance)} ${selectedToken}.`);
      return;
    }

    setError(undefined);
    setPhase("submitting");
    try {
      const res = await (onUnshield
        ? onUnshield(value)
        : new Promise<void>((r) => setTimeout(r, 1200)));
      setDone({ amount: value, txHash: typeof res === "string" ? res : undefined });
      setPhase("done");
    } catch (err) {
      setError(friendlyError(err));
      setPhase("form");
    }
  }

  if (phase === "done") {
    return (
      <DoneModal
        title="Funds Unshielded"
        detail={`${formatAmount(done.amount)} ${selectedToken} has been withdrawn from the privacy pool back into your transparent public account.`}
        txHash={done.txHash}
        onDone={() => {
          setPhase("form");
          setAmount("");
        }}
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <div className="max-w-[460px] mx-auto rounded-[32px] bg-white p-4 sm:p-5 border border-[#e4e7ec] shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-3">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Top Input Box */}
        <div className="rounded-[24px] border border-[#e4e7ec] bg-[#fcfdfd] p-5 space-y-3 shadow-sm transition-all focus-within:ring-2 focus-within:ring-border-strong focus-within:border-border-strong">
          <div className="flex items-center justify-between">
            <span className="text-[13px] sm:text-[14px] font-semibold text-fg">
              You&apos;re Unshielding
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setError(undefined);
                setAmount(e.target.value.replace(/[^0-9.]/g, ""));
              }}
              disabled={busy}
              className="w-full bg-transparent font-normal text-4xl sm:text-5xl text-fg outline-none placeholder:text-[#98a2b3]"
            />

            {/* Token Selector Pill */}
            <button
              type="button"
              onClick={() => setTokenModalOpen(true)}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#eef2f6] hover:bg-[#e2e8f0] px-3.5 py-1.5 text-[13px] font-medium text-fg cursor-pointer transition-colors"
            >
              <span>{selectedToken}</span>
              <span className="text-[11px] text-muted">↕</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1 text-[13px] text-muted">
            <div className="flex items-center gap-1">
              <span className="text-[11px]">↓↑</span>
              <span>{usdValue}</span>
            </div>
            <div>
              Shielded: <span className="font-mono text-fg">{formatAmount(shieldedBalance)}</span> ·{" "}
              <button
                type="button"
                onClick={() => setAmount(String(shieldedBalance))}
                className="font-medium text-fg hover:text-fg transition-colors"
              >
                Max
              </button>
            </div>
          </div>
        </div>

        {/* Unshielding Fee Container */}
        <div className="rounded-[18px] border border-[#e4e7ec] bg-white px-5 py-4 flex items-center justify-between text-[14px] shadow-sm">
          <span className="text-muted font-medium">Unshielding Fee</span>
          <span className="text-fg font-medium">No Fee · $0.00</span>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Action Button */}
        {!connected ? (
          <PrimaryButton type="button" onClick={onConnect}>
            Get Started
          </PrimaryButton>
        ) : (
          <PrimaryButton type="submit" busy={busy}>
            {busy ? "Unshielding Funds…" : "Get Started"}
          </PrimaryButton>
        )}
      </form>

      <TokenSelectModal
        open={tokenModalOpen}
        onClose={() => setTokenModalOpen(false)}
        selected={selectedToken}
        onSelect={(t) => {
          setSelectedToken(t);
          setTokenModalOpen(false);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- Receive Tab */

export function ReceiveTab({
  address,
  connected = true,
  onConnect,
}: {
  address: string;
  receivable?: boolean;
  connected?: boolean;
  onConnect?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="max-w-xl mx-auto rounded-3xl bg-surface p-6 sm:p-8 ring-1 ring-border shadow-sm text-center">
      <div className="flex items-center justify-between pb-5 border-b border-border text-left">
        <div>
          <h2 className="text-[17px] font-bold text-fg">Receive Privately</h2>
          <p className="text-[12px] text-muted">Umbra-style stealth note discovery</p>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-fg ring-1 ring-border">
          {connected ? "Active" : "Ready"}
        </span>
      </div>

      {!connected || !address ? (
        <div className="mt-8 flex flex-col items-center gap-5 py-6">
          <p className="max-w-md text-[14px] leading-relaxed text-muted">
            Connect your Starknet wallet to generate and view your private receiving stealth address and QR code.
          </p>
          <div className="w-full max-w-xs">
            <PrimaryButton onClick={onConnect}>
              Connect wallet
            </PrimaryButton>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col items-center gap-6">
          {/* QR container */}
          <div className="rounded-3xl bg-white p-5 shadow-lg ring-1 ring-border">
          <QRCode
            value={address}
            size={200}
            bgColor="#ffffff"
            fgColor="#000000"
            aria-label="QR Code of Privacy Receive Address"
          />
        </div>

        {/* Address Display */}
        <div className="w-full space-y-3">
          <div className="break-all rounded-2xl bg-surface-2 px-4 py-3.5 font-mono text-[13px] leading-relaxed text-fg ring-1 ring-border select-all">
            {address}
          </div>

          <PrimaryButton onClick={copy}>
            {copied ? "Copied to Clipboard" : "Copy Receive Address"}
          </PrimaryButton>
        </div>

        {/* Discovery Service explanation */}
        <div className="rounded-2xl bg-surface-2 p-4 text-left ring-1 ring-border space-y-1.5 text-[12px] text-muted">
          <div className="text-fg font-semibold">
            <span>How incoming money is discovered:</span>
          </div>
          <p className="leading-relaxed">
            Senders deposit notes into the STRK20 pool encrypted for your viewing key. Your wallet scans the pool events to detect and unlock incoming funds automatically.
          </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Activity Tab */

export function ActivityTab({
  activity,
  token,
}: {
  activity: ActivityItem[];
  token: string;
}) {
  const [filter, setFilter] = useState<"all" | "shield" | "transfer" | "unshield">("all");

  const filtered = activity.filter((item) => {
    if (filter === "all") return true;
    if (filter === "shield") return item.kind === "shield";
    if (filter === "transfer") return item.kind === "sent" || item.kind === "received";
    if (filter === "unshield") return item.kind === "unshield";
    return true;
  });

  return (
    <div className="max-w-3xl mx-auto rounded-3xl bg-surface p-6 sm:p-8 ring-1 ring-border shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border">
        <div>
          <h2 className="text-[18px] font-bold text-fg">Privacy Activity History</h2>
          <p className="text-[12px] text-muted">Track your deposits, private sends, and withdrawals</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-border">
          {(["all", "shield", "transfer", "unshield"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-all ${
                filter === f
                  ? "bg-black text-white font-semibold ring-1 ring-black shadow-sm"
                  : "text-muted hover:text-fg"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 divide-y divide-border">
          {filtered.map((item) => (
            <div key={item.id} className="py-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-fg capitalize">
                    {item.kind === "sent" ? "Private Transfer" : item.kind}
                  </span>
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-muted ring-1 ring-border">
                    STRK20 Pool
                  </span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-muted mt-0.5">
                  <span>{item.at}</span>
                  <span>•</span>
                  <a
                    href={txUrl(item.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg hover:underline font-mono text-[11px]"
                  >
                    {truncateAddress(item.id, 8, 6)}
                  </a>
                </div>
              </div>

              <div className="text-right">
                <p className="font-mono text-[15px] font-bold text-fg tabular-nums">
                  {item.kind === "sent" ? "-" : "+"}
                  {formatAmount(item.amount)} {token}
                </p>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg">
                  <span className="size-1.5 rounded-full bg-black" /> Confirmed
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-muted">
          <p className="text-[14px]">No transactions found for filter &quot;{filter}&quot;.</p>
        </div>
      )}
    </div>
  );
}
