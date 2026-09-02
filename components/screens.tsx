"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { validateAndParseAddress } from "starknet";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Check,
  Copy,
  ExternalLink,
  Info,
  Lock,
  QrCode,
  ShieldCheck,
  ShieldPlus,
  Spinner,
  Unlock,
  Wallet,
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
    variant === "accent"
      ? "bg-accent hover:bg-accent-strong text-bg shadow-[0_0_20px_rgba(157,140,255,0.25)]"
      : variant === "emerald"
        ? "bg-success hover:bg-emerald-400 text-bg shadow-[0_0_20px_rgba(52,211,153,0.25)]"
        : "bg-surface-2 hover:bg-surface-2/80 text-fg ring-1 ring-border";

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className={`flex h-13 w-full items-center justify-center gap-2.5 rounded-2xl px-5 text-[15px] font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 disabled:cursor-not-allowed ${bg}`}
    >
      {busy && <Spinner size={18} />}
      {children}
    </button>
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
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-10 text-center animate-in fade-in zoom-in-95 duration-200">
      <span className="flex size-18 items-center justify-center rounded-3xl bg-surface-2 text-success ring-1 ring-border shadow-[0_0_30px_rgba(52,211,153,0.15)]">
        <Check size={32} />
      </span>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-fg">{title}</h2>
        <p className="max-w-md text-[14px] leading-relaxed text-muted">{detail}</p>
      </div>

      {txHash && (
        <div className="flex items-center gap-2 rounded-2xl bg-surface-2/70 p-1.5 ring-1 ring-border">
          <button
            type="button"
            onClick={copyHash}
            className="flex h-9 items-center gap-2 rounded-xl bg-surface px-3 font-mono text-[12px] text-muted ring-1 ring-border transition-colors hover:text-fg hover:ring-border-strong"
          >
            {truncateAddress(txHash, 10, 8)}
            {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
          </button>
          <a
            href={txUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center gap-1.5 rounded-xl px-3 text-[12px] font-medium text-accent hover:bg-surface"
          >
            Voyager <ExternalLink size={12} />
          </a>
        </div>
      )}

      <div className="w-full max-w-xs pt-2">
        <PrimaryButton onClick={onDone}>Return to App</PrimaryButton>
      </div>
    </div>
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
  onNavigate: (tab: "shield" | "transfer" | "unshield" | "receive" | "activity") => void;
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
  const { int: sInt, frac: sFrac } = splitAmount(shielded);
  const { int: pInt, frac: pFrac } = splitAmount(publicBalance);

  return (
    <div className="space-y-6">
      {/* Hero Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Shielded Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-surface/90 p-6 ring-1 ring-border backdrop-blur-xl transition-all">
          <div className="kairo-glow pointer-events-none absolute inset-x-0 top-0 h-32" />
          <div className="relative space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-accent">
                <ShieldCheck size={16} /> Shielded Balance
              </span>
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-accent ring-1 ring-accent/30">
                Private & Unlinkable
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-mono text-4xl font-bold tracking-tight text-fg tabular-nums sm:text-5xl">
                {sInt}
                {sFrac && <span className="text-muted">.{sFrac}</span>}
              </span>
              <span className="text-xl font-semibold text-muted">{token}</span>
            </div>

            {pending > 0 ? (
              <p className="flex items-center gap-2 text-[12px] text-success">
                <span className="size-2 rounded-full bg-success animate-pulse" />
                <span>+{formatAmount(pending)} {token} confirming note maturity (~5m)</span>
              </p>
            ) : (
              <p className="text-[12px] text-faint">
                Available for zero-knowledge private transfers and withdrawals.
              </p>
            )}

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onNavigate("transfer")}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg transition-all hover:bg-accent-strong"
              >
                <ArrowUpRight size={15} /> Send Privately
              </button>
              <button
                type="button"
                onClick={() => onNavigate("receive")}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] font-semibold text-fg ring-1 ring-border transition-all hover:bg-surface-2/80"
              >
                <QrCode size={15} /> Receive
              </button>
            </div>
          </div>
        </div>

        {/* Public Balance Card */}
        <div className="relative overflow-hidden rounded-3xl bg-surface/70 p-6 ring-1 ring-border backdrop-blur-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                <Wallet size={16} /> Public Balance
              </span>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-faint ring-1 ring-border">
                On-Chain Starknet
              </span>
            </div>

            <div className="flex items-baseline gap-2 pt-1">
              <span className="font-mono text-4xl font-bold tracking-tight text-fg tabular-nums sm:text-5xl">
                {pInt}
                {pFrac && <span className="text-muted">.{pFrac}</span>}
              </span>
              <span className="text-xl font-semibold text-muted">{token}</span>
            </div>

            <p className="text-[12px] text-faint">
              Standard Starknet balance visible on public block explorers.
            </p>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => onNavigate("shield")}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-2.5 text-[13px] font-semibold text-fg ring-1 ring-border transition-all hover:bg-surface-2/80"
              >
                <ShieldPlus size={15} className="text-accent" /> Shield Funds
              </button>
              <button
                type="button"
                onClick={() => onNavigate("unshield")}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px] font-semibold text-muted ring-1 ring-border transition-all hover:bg-surface-2/80 hover:text-fg"
              >
                <ArrowLeftRight size={15} /> Unshield
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Action Banner */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Shield (Deposit)", desc: "Public → Private", icon: ShieldPlus, tab: "shield" as const },
          { label: "Private Send", desc: "STARK proof transfer", icon: ArrowUpRight, tab: "transfer" as const },
          { label: "Unshield", desc: "Private → Public", icon: ArrowLeftRight, tab: "unshield" as const },
          { label: "Receive Stealth", desc: "QR & View Keys", icon: ArrowDownLeft, tab: "receive" as const },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onNavigate(item.tab)}
              className="group flex flex-col items-start gap-1 rounded-2xl bg-surface/70 p-4 text-left ring-1 ring-border transition-all hover:bg-surface-2 hover:ring-border-strong"
            >
              <span className="flex size-8 items-center justify-center rounded-lg bg-surface-2 text-accent ring-1 ring-border group-hover:bg-accent group-hover:text-bg transition-colors">
                <Icon size={16} />
              </span>
              <span className="mt-1 text-[13px] font-semibold text-fg">{item.label}</span>
              <span className="text-[11px] text-faint">{item.desc}</span>
            </button>
          );
        })}
      </div>

      {/* Recent Activity Mini-Feed */}
      <div className="rounded-3xl bg-surface/70 p-6 ring-1 ring-border">
        <div className="flex items-center justify-between pb-4 border-b border-border/70">
          <h3 className="text-[15px] font-semibold text-fg">Recent Privacy Activity</h3>
          <button
            type="button"
            onClick={() => onNavigate("activity")}
            className="text-[13px] font-medium text-accent hover:underline"
          >
            View all history →
          </button>
        </div>

        {activity.length > 0 ? (
          <ul className="mt-3 divide-y divide-border/40">
            {activity.slice(0, 4).map((item) => (
              <li key={item.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-accent ring-1 ring-border">
                    {item.kind === "shield" ? (
                      <ShieldPlus size={16} />
                    ) : item.kind === "unshield" ? (
                      <ArrowLeftRight size={16} />
                    ) : (
                      <ArrowUpRight size={16} />
                    )}
                  </span>
                  <div>
                    <p className="text-[13px] font-medium text-fg capitalize">{item.kind}</p>
                    <p className="text-[11px] text-faint">{item.at}</p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="font-mono text-[14px] font-semibold text-fg tabular-nums">
                    {item.kind === "sent" ? "-" : "+"}
                    {formatAmount(item.amount)} {token}
                  </p>
                  <span className="inline-block rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                    Confirmed
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center text-faint">
            <p className="text-[13px]">No recent pool activity recorded for this session.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Shield Tab */

export function ShieldTab({
  publicBalance,
  token,
  feeStrk = 6,
  onShield,
}: {
  publicBalance: number;
  token: string;
  feeStrk?: number;
  onShield?: (amount: number) => Promise<string | void>;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [done, setDone] = useState<{ amount: number; txHash?: string }>({ amount: 0 });

  const maxShield = Math.max(0, publicBalance - feeStrk);

  function setPercentage(pct: number) {
    if (publicBalance <= 0) return;
    const raw = (publicBalance * pct) / 100;
    const calc = Math.max(0, raw - feeStrk);
    setAmount(calc > 0 ? Number(calc.toFixed(4)).toString() : "0");
    setError(undefined);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setError("Please enter a valid amount to shield.");
      return;
    }
    if (value > maxShield) {
      setError(`Max shieldable amount is ${formatAmount(maxShield)} ${token} (after reserving ${feeStrk} STRK fee).`);
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
        detail={`${formatAmount(done.amount)} ${token} has been successfully deposited into the STRK20 privacy pool. It becomes spendable in private notes within ~5 minutes.`}
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
    <div className="max-w-xl mx-auto rounded-3xl bg-surface/90 p-6 sm:p-8 ring-1 ring-border backdrop-blur-xl">
      <div className="flex items-center justify-between pb-5 border-b border-border/70">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <ShieldPlus size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-fg">Shield STRK</h2>
            <p className="text-[12px] text-faint">Deposit public STRK into the STRK20 Privacy Pool</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-border">
          Deposit
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-6">
        {/* Source & Destination Preview */}
        <div className="rounded-2xl bg-surface-2/60 p-4 ring-1 ring-border space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">From Public Wallet</span>
            <span className="font-mono font-medium text-fg">
              {formatAmount(publicBalance)} {token}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <span className="flex size-7 items-center justify-center rounded-full bg-surface text-accent ring-1 ring-border">
              ↓
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">To Shielded Pool</span>
            <span className="font-semibold text-success flex items-center gap-1.5">
              <Lock size={13} /> Private Balance
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-fg">Amount to Shield</label>
            <span className="text-[12px] text-faint">
              Available: <span className="font-mono text-fg">{formatAmount(publicBalance)} {token}</span>
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              disabled={busy}
              className="h-14 w-full rounded-2xl bg-surface pl-4 pr-24 font-mono text-lg font-medium text-fg ring-1 ring-border transition-all placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="absolute inset-y-0 right-3 flex items-center gap-2">
              <span className="font-semibold text-muted text-[14px]">{token}</span>
            </div>
          </div>

          {/* Quick percentage buttons */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            {[25, 50, 75, 100].map((pct) => (
              <button
                key={pct}
                type="button"
                onClick={() => setPercentage(pct)}
                disabled={busy || publicBalance <= 0}
                className="h-8 rounded-xl bg-surface-2 text-[12px] font-medium text-muted ring-1 ring-border transition-colors hover:bg-surface-2/80 hover:text-fg disabled:opacity-40"
              >
                {pct === 100 ? "Max" : `${pct}%`}
              </button>
            ))}
          </div>

          {error && <p className="text-[13px] text-danger pt-1">{error}</p>}
        </div>

        {/* Fee & Privacy Info */}
        <div className="rounded-2xl bg-surface-2/40 p-4 ring-1 ring-border space-y-2 text-[12px]">
          <div className="flex justify-between text-muted">
            <span>STRK20 Protocol Fee</span>
            <span className="font-mono text-fg">{feeStrk} {token}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Note Maturity Window</span>
            <span className="text-fg">~5 minutes (10 blocks)</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Privacy Guarantee</span>
            <span className="text-success font-medium">Zero Calldata Leakage</span>
          </div>
        </div>

        <PrimaryButton type="submit" busy={busy}>
          {busy ? "Shielding Funds…" : `Shield ${token}`}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------ Transfer Tab */

export function TransferTab({
  spendable,
  token,
  feeStrk = 6,
  onSubmit,
  checkRecipient,
}: {
  spendable: number;
  token: string;
  feeStrk?: number;
  onSubmit?: (recipient: string, amount: number) => Promise<string | void>;
  checkRecipient?: (recipient: string) => Promise<boolean | undefined>;
}) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ recipient?: string; amount?: string }>({});
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [recipientValid, setRecipientValid] = useState<boolean | null>(null);
  const [checkingRecipient, setCheckingRecipient] = useState(false);
  const [sent, setSent] = useState<{ amount: number; recipient: string; txHash?: string }>({
    amount: 0,
    recipient: "",
  });

  const maxSend = Math.max(0, spendable - feeStrk);

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
    } else if (value > maxSend) {
      next.amount = `Max sendable is ${formatAmount(maxSend)} ${token} (${feeStrk} STRK fee reserved).`;
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
        detail={`${formatAmount(sent.amount)} ${token} has been privately routed through the STRK20 pool to ${truncateAddress(sent.recipient)}. Zero sender linkage exists on-chain.`}
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
    <div className="max-w-xl mx-auto rounded-3xl bg-surface/90 p-6 sm:p-8 ring-1 ring-border backdrop-blur-xl">
      <div className="flex items-center justify-between pb-5 border-b border-border/70">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <ArrowUpRight size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-fg">Private Transfer</h2>
            <p className="text-[12px] text-faint">Relayer-submitted STARK proof note creation</p>
          </div>
        </div>
        <span className="rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-medium text-accent ring-1 ring-accent/30">
          ZK Shielded
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Recipient Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-fg">Recipient Address</label>
            {checkingRecipient ? (
              <span className="flex items-center gap-1 text-[11px] text-faint">
                <Spinner size={12} /> Checking viewing key…
              </span>
            ) : recipientValid === true ? (
              <span className="flex items-center gap-1 text-[11px] text-success font-medium">
                <Check size={12} /> Viewing key registered
              </span>
            ) : recipientValid === false ? (
              <span className="text-[11px] text-warning">Viewing key not detected</span>
            ) : null}
          </div>

          <input
            type="text"
            placeholder="0x…"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            onBlur={handleRecipientBlur}
            disabled={busy}
            className="h-14 w-full rounded-2xl bg-surface px-4 font-mono text-[13px] text-fg ring-1 ring-border transition-all placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.recipient && <p className="text-[13px] text-danger">{errors.recipient}</p>}
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-fg">Amount</label>
            <span className="text-[12px] text-faint">
              Shielded: <span className="font-mono text-fg">{formatAmount(spendable)} {token}</span>
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              disabled={busy}
              className="h-14 w-full rounded-2xl bg-surface pl-4 pr-24 font-mono text-lg font-medium text-fg ring-1 ring-border transition-all placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="absolute inset-y-0 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAmount(String(maxSend))}
                disabled={busy}
                className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent hover:text-bg transition-colors"
              >
                Max
              </button>
              <span className="font-semibold text-muted text-[14px]">{token}</span>
            </div>
          </div>
          {errors.amount && <p className="text-[13px] text-danger">{errors.amount}</p>}
        </div>

        {/* Relayer & Privacy details */}
        <div className="rounded-2xl bg-surface-2/40 p-4 ring-1 ring-border space-y-2 text-[12px]">
          <div className="flex justify-between text-muted">
            <span>AVNU Paymaster Gas</span>
            <span className="text-success font-medium">Sponsored / Relayed</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>STRK20 Pool Fee</span>
            <span className="font-mono text-fg">{feeStrk} {token}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Calldata Anonymity</span>
            <span className="text-fg">Sender omitted from calldata</span>
          </div>
        </div>

        <PrimaryButton type="submit" busy={busy}>
          {busy ? "Sending Privately…" : "Execute Private Transfer"}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------ Unshield Tab */

export function UnshieldTab({
  shieldedBalance,
  token,
  feeStrk = 6,
  onUnshield,
}: {
  shieldedBalance: number;
  token: string;
  feeStrk?: number;
  onUnshield?: (amount: number) => Promise<string | void>;
}) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [done, setDone] = useState<{ amount: number; txHash?: string }>({ amount: 0 });

  const maxUnshield = Math.max(0, shieldedBalance - feeStrk);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setError("Please enter an amount to unshield.");
      return;
    }
    if (value > maxUnshield) {
      setError(`Max unshieldable is ${formatAmount(maxUnshield)} ${token} (${feeStrk} STRK fee reserved).`);
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
        detail={`${formatAmount(done.amount)} ${token} has been withdrawn from the privacy pool back into your transparent public account.`}
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
    <div className="max-w-xl mx-auto rounded-3xl bg-surface/90 p-6 sm:p-8 ring-1 ring-border backdrop-blur-xl">
      <div className="flex items-center justify-between pb-5 border-b border-border/70">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <ArrowLeftRight size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-fg">Unshield STRK</h2>
            <p className="text-[12px] text-faint">Withdraw shielded funds back to your public balance</p>
          </div>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-border">
          Withdraw
        </span>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        {/* Source / Dest Preview */}
        <div className="rounded-2xl bg-surface-2/60 p-4 ring-1 ring-border space-y-3">
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">From Shielded Pool</span>
            <span className="font-mono font-medium text-fg">
              {formatAmount(shieldedBalance)} {token}
            </span>
          </div>
          <div className="flex items-center justify-center">
            <span className="flex size-7 items-center justify-center rounded-full bg-surface text-accent ring-1 ring-border">
              ↓
            </span>
          </div>
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">To Public Balance</span>
            <span className="font-semibold text-muted flex items-center gap-1.5">
              <Unlock size={13} /> Transparent Wallet
            </span>
          </div>
        </div>

        {/* Amount Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[13px] font-semibold text-fg">Amount to Unshield</label>
            <span className="text-[12px] text-faint">
              Shielded: <span className="font-mono text-fg">{formatAmount(shieldedBalance)} {token}</span>
            </span>
          </div>

          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              disabled={busy}
              className="h-14 w-full rounded-2xl bg-surface pl-4 pr-24 font-mono text-lg font-medium text-fg ring-1 ring-border transition-all placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="absolute inset-y-0 right-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAmount(String(maxUnshield))}
                disabled={busy}
                className="rounded-lg bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-accent hover:bg-accent hover:text-bg transition-colors"
              >
                Max
              </button>
              <span className="font-semibold text-muted text-[14px]">{token}</span>
            </div>
          </div>
          {error && <p className="text-[13px] text-danger">{error}</p>}
        </div>

        {/* Hygiene Warning (Umbra best practice) */}
        <div className="rounded-2xl bg-surface-2/40 p-4 ring-1 ring-border space-y-2 text-[12px]">
          <div className="flex items-center gap-1.5 text-warning font-medium">
            <Info size={14} />
            <span>Privacy Note:</span>
          </div>
          <p className="text-faint leading-relaxed">
            Unshielding creates a public withdrawal event on Voyager. To maximize privacy, avoid immediately consolidating with known public identities.
          </p>
        </div>

        <PrimaryButton type="submit" busy={busy}>
          {busy ? "Unshielding Funds…" : `Unshield ${token}`}
        </PrimaryButton>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------- Receive Tab */

export function ReceiveTab({
  address,
}: {
  address: string;
  receivable?: boolean;
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
    <div className="max-w-xl mx-auto rounded-3xl bg-surface/90 p-6 sm:p-8 ring-1 ring-border backdrop-blur-xl text-center">
      <div className="flex items-center justify-between pb-5 border-b border-border/70 text-left">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-2xl bg-accent/15 text-accent ring-1 ring-accent/30">
            <QrCode size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-fg">Receive Privately</h2>
            <p className="text-[12px] text-faint">Umbra-style stealth note discovery</p>
          </div>
        </div>
        <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-medium text-success ring-1 ring-success/30">
          Active
        </span>
      </div>

      <div className="mt-8 flex flex-col items-center gap-6">
        {/* QR container */}
        <div className="rounded-3xl bg-white p-5 shadow-2xl ring-4 ring-white/10">
          <QRCode
            value={address}
            size={200}
            bgColor="#ffffff"
            fgColor="#07070b"
            aria-label="QR Code of Privacy Receive Address"
          />
        </div>

        {/* Address Display */}
        <div className="w-full space-y-3">
          <div className="break-all rounded-2xl bg-surface px-4 py-3.5 font-mono text-[13px] leading-relaxed text-muted ring-1 ring-border select-all">
            {address}
          </div>

          <PrimaryButton onClick={copy}>
            {copied ? (
              <>
                <Check size={16} /> Copied to Clipboard
              </>
            ) : (
              <>
                <Copy size={16} /> Copy Receive Address
              </>
            )}
          </PrimaryButton>
        </div>

        {/* Discovery Service explanation */}
        <div className="rounded-2xl bg-surface-2/40 p-4 text-left ring-1 ring-border space-y-1.5 text-[12px] text-faint">
          <div className="flex items-center gap-1.5 text-muted font-medium">
            <ShieldCheck size={14} className="text-accent" />
            <span>How incoming money is discovered:</span>
          </div>
          <p className="leading-relaxed">
            Senders deposit notes into the STRK20 pool encrypted for your viewing key. Your wallet scans the pool events to detect and unlock incoming funds automatically.
          </p>
        </div>
      </div>
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
    <div className="max-w-3xl mx-auto rounded-3xl bg-surface/90 p-6 sm:p-8 ring-1 ring-border backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-6 border-b border-border/70">
        <div>
          <h2 className="text-[18px] font-bold text-fg">Privacy Activity History</h2>
          <p className="text-[12px] text-faint">Track your deposits, private sends, and withdrawals</p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
          {(["all", "shield", "transfer", "unshield"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-full px-3 py-1 text-[12px] font-medium capitalize transition-all ${
                filter === f
                  ? "bg-surface-2 text-accent ring-1 ring-border-strong font-semibold"
                  : "text-muted hover:text-fg"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="mt-4 divide-y divide-border/40">
          {filtered.map((item) => (
            <div key={item.id} className="py-4 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <span className="flex size-10 items-center justify-center rounded-2xl bg-surface-2 text-accent ring-1 ring-border">
                  {item.kind === "shield" ? (
                    <ShieldPlus size={18} />
                  ) : item.kind === "unshield" ? (
                    <ArrowLeftRight size={18} />
                  ) : (
                    <ArrowUpRight size={18} />
                  )}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-fg capitalize">
                      {item.kind === "sent" ? "Private Transfer" : item.kind}
                    </span>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[10px] text-faint ring-1 ring-border">
                      STRK20 Pool
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[12px] text-faint mt-0.5">
                    <span>{item.at}</span>
                    <span>•</span>
                    <a
                      href={txUrl(item.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-accent hover:underline font-mono text-[11px]"
                    >
                      {truncateAddress(item.id, 8, 6)} <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              </div>

              <div className="text-right">
                <p className="font-mono text-[15px] font-bold text-fg tabular-nums">
                  {item.kind === "sent" ? "-" : "+"}
                  {formatAmount(item.amount)} {token}
                </p>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-success">
                  <span className="size-1.5 rounded-full bg-success" /> Confirmed
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-16 text-center text-faint">
          <p className="text-[14px]">No transactions found for filter &quot;{filter}&quot;.</p>
        </div>
      )}
    </div>
  );
}
