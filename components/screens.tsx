"use client";

import { useId, useState } from "react";
import QRCode from "react-qr-code";
import { validateAndParseAddress } from "starknet";
import {
  ArrowLeft,
  Check,
  Copy,
  Shield,
  Spinner,
} from "@/components/icons";
import { txUrl } from "@/lib/explorer";
import { formatAmount, truncateAddress } from "@/lib/format";

/* ---------------------------------------------------------------- shared */

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back"
        className="-ml-2 flex size-10 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-surface hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <ArrowLeft size={19} />
      </button>
      <h1 className="text-[17px] font-semibold tracking-tight">{title}</h1>
    </header>
  );
}

function PrimaryButton({
  children,
  busy,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || busy}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-5 text-[15px] font-semibold text-bg transition-colors duration-150 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50"
    >
      {busy && <Spinner size={18} />}
      {children}
    </button>
  );
}

function Done({
  title,
  detail,
  txHash,
  onDone,
}: {
  title: string;
  detail: string;
  /** On-chain tx hash — shown with copy + explorer link when present. */
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
    <div className="flex flex-1 flex-col items-center justify-center gap-8 py-10 text-center">
      <span className="flex size-16 items-center justify-center rounded-full bg-surface text-success ring-1 ring-border">
        <Check size={30} />
      </span>
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="max-w-[19rem] text-[14px] leading-6 text-muted">{detail}</p>
      </div>
      {txHash && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyHash}
            aria-label={copied ? "Transaction hash copied" : "Copy transaction hash"}
            className="flex h-9 items-center gap-2 rounded-full bg-surface px-3.5 font-mono text-[12px] text-muted ring-1 ring-border transition-colors duration-150 hover:text-fg hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {truncateAddress(txHash, 10, 6)}
            {copied ? (
              <Check size={13} className="text-success" />
            ) : (
              <Copy size={13} />
            )}
          </button>
          <a
            href={txUrl(txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 items-center rounded-full px-3 text-[12px] font-medium text-accent transition-colors duration-150 hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Voyager
          </a>
        </div>
      )}
      <div className="w-full max-w-[16rem]">
        <PrimaryButton onClick={onDone}>Done</PrimaryButton>
      </div>
    </div>
  );
}

/** Map wallet rejections to calm copy; pass other errors through. */
function friendlyError(err: unknown): string {
  const msg = String((err as Error)?.message ?? err);
  return /reject|declin|denied|abort|cancel/i.test(msg)
    ? "Declined in the wallet."
    : msg;
}

/* --------------------------------------------------------------- Receive */

export function ReceiveScreen({
  address,
  onBack,
}: {
  address: string;
  onBack: () => void;
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
    <div className="flex flex-1 flex-col gap-7 py-6">
      <SubHeader title="Receive privately" onBack={onBack} />

      <div className="flex flex-col items-center gap-6">
        {/* QR stays dark-on-white — scanners need the contrast. */}
        <div className="rounded-card bg-white p-5">
          <QRCode
            value={address}
            size={196}
            bgColor="#ffffff"
            fgColor="#0b0a10"
            aria-label="QR code of your receive address"
          />
        </div>

        <div className="flex w-full flex-col gap-3">
          <p className="break-all rounded-2xl bg-surface px-4 py-3.5 text-center font-mono text-[13px] leading-6 text-muted ring-1 ring-border">
            {address}
          </p>
          <PrimaryButton onClick={copy}>
            {copied ? (
              <>
                <Check size={17} /> Copied
              </>
            ) : (
              <>
                <Copy size={17} /> Copy address
              </>
            )}
          </PrimaryButton>
        </div>

        <p className="flex max-w-[21rem] items-start gap-2.5 text-left text-[13px] leading-5 text-faint">
          <Shield size={15} className="mt-0.5 shrink-0 text-accent" />
          Share this address with anyone. Payments land in your shielded
          balance — the amount and sender stay private on-chain.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Send */

export function SendScreen({
  spendable,
  token,
  feeStrk = 0,
  onBack,
  onSubmit,
  checkRecipient,
}: {
  spendable: number;
  token: string;
  /** Pool protocol fee per action, reserved out of the sendable maximum. */
  feeStrk?: number;
  onBack: () => void;
  /** Perform the real send. Resolves to the tx hash when confirmed. */
  onSubmit?: (recipient: string, amount: number) => Promise<string | void>;
  /**
   * Pre-check whether the recipient can receive privately (registered viewing
   * key). undefined = check unavailable → proceed anyway.
   */
  checkRecipient?: (recipient: string) => Promise<boolean | undefined>;
}) {
  const recipientId = useId();
  const amountId = useId();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [errors, setErrors] = useState<{ recipient?: string; amount?: string }>({});
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [sent, setSent] = useState<{
    amount: number;
    recipient: string;
    txHash?: string;
  }>({ amount: 0, recipient: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};

    let parsedRecipient = "";
    try {
      parsedRecipient = validateAndParseAddress(recipient.trim());
    } catch {
      next.recipient = "That doesn't look like a Starknet address.";
    }

    const value = Number(amount);
    const maxSend = Math.max(0, spendable - feeStrk);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      next.amount = "Enter an amount to send.";
    } else if (value > maxSend) {
      next.amount =
        feeStrk > 0
          ? `You can send up to ${formatAmount(maxSend)} ${token} — the ${feeStrk} STRK network fee is reserved.`
          : `You can send up to ${formatAmount(maxSend)} ${token}.`;
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setPhase("submitting");
    try {
      // Recipient must hold a registered viewing key to receive privately —
      // cheap RPC pre-check beats a cryptic wallet error (and a burned fee).
      if (checkRecipient) {
        const ok = await checkRecipient(parsedRecipient);
        if (ok === false) {
          setErrors({
            recipient:
              "This address can't receive private payments yet — ask them to shield once in their Ready wallet first.",
          });
          setPhase("form");
          return;
        }
      }

      // Real path: strk20InvokeTransaction via the connected wallet (the
      // wallet holds keys and builds the proof). Demo mode simulates.
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
      <Done
        title="Sent privately"
        detail={`${formatAmount(sent.amount)} ${token} is on its way to ${truncateAddress(sent.recipient)}. Nothing on-chain links it to you.`}
        txHash={sent.txHash}
        onDone={onBack}
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <div className="flex flex-1 flex-col gap-7 py-6">
      <SubHeader title="Send privately" onBack={onBack} />

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <label htmlFor={recipientId} className="px-1 text-[13px] font-medium text-muted">
            To
          </label>
          <input
            id={recipientId}
            name="recipient"
            type="text"
            autoComplete="off"
            spellCheck={false}
            placeholder="0x…"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            disabled={busy}
            aria-invalid={Boolean(errors.recipient)}
            aria-describedby={errors.recipient ? `${recipientId}-error` : undefined}
            className="h-13 w-full rounded-2xl bg-surface px-4 font-mono text-[14px] text-fg ring-1 ring-border transition-shadow duration-150 placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {errors.recipient && (
            <p id={`${recipientId}-error`} className="px-1 text-[13px] text-danger">
              {errors.recipient}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <label htmlFor={amountId} className="text-[13px] font-medium text-muted">
              Amount
            </label>
            <span className="text-[12px] text-faint">
              Available:{" "}
              <span className="font-mono tabular-nums">
                {formatAmount(spendable)} {token}
              </span>
            </span>
          </div>
          <div className="relative">
            <input
              id={amountId}
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              disabled={busy}
              aria-invalid={Boolean(errors.amount)}
              aria-describedby={errors.amount ? `${amountId}-error` : undefined}
              className="h-13 w-full rounded-2xl bg-surface pl-4 pr-24 font-mono text-[15px] tabular-nums text-fg ring-1 ring-border transition-shadow duration-150 placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setAmount(String(Math.max(0, spendable - feeStrk)))
                }
                disabled={busy}
                className="flex h-8 items-center rounded-full bg-surface-2 px-3 text-[12px] font-semibold text-accent transition-colors duration-150 hover:bg-accent hover:text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Max
              </button>
              <span className="text-[14px] font-medium text-muted">{token}</span>
            </div>
          </div>
          {errors.amount && (
            <p id={`${amountId}-error`} className="px-1 text-[13px] text-danger">
              {errors.amount}
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <p className="text-center text-[12px] text-faint">
            {busy
              ? "Ready will ask you to approve two steps — that's normal."
              : feeStrk > 0
                ? `Network fee: ${feeStrk} STRK`
                : "Includes a small network fee."}
          </p>
          <PrimaryButton type="submit" busy={busy}>
            {busy ? "Sending…" : "Send privately"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

/* ---------------------------------------------------------------- Shield */

export function ShieldScreen({
  publicBalance,
  shieldedBalance,
  token,
  feeStrk = 0,
  onBack,
  onShield,
  onUnshield,
}: {
  publicBalance: number;
  /** Spendable shielded balance — the source when unshielding. */
  shieldedBalance: number;
  token: string;
  /** Pool protocol fee per action, reserved out of the movable maximum. */
  feeStrk?: number;
  onBack: () => void;
  /** Perform the real shield. Resolves to the tx hash when confirmed. */
  onShield?: (amount: number) => Promise<string | void>;
  /** Perform the real unshield (withdraw to self). */
  onUnshield?: (amount: number) => Promise<string | void>;
}) {
  const amountId = useId();
  const [mode, setMode] = useState<"shield" | "unshield">("shield");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string>();
  const [phase, setPhase] = useState<"form" | "submitting" | "done">("form");
  const [done, setDone] = useState<{ amount: number; txHash?: string }>({
    amount: 0,
  });

  const shielding = mode === "shield";
  const available = shielding ? publicBalance : shieldedBalance;
  const maxMove = Math.max(0, available - feeStrk);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!amount || !Number.isFinite(value) || value <= 0) {
      setError(`Enter an amount to ${mode}.`);
      return;
    }
    if (value > maxMove) {
      setError(
        feeStrk > 0
          ? `You can ${mode} up to ${formatAmount(maxMove)} ${token} — the ${feeStrk} STRK network fee is reserved.`
          : `You have ${formatAmount(maxMove)} ${token} available.`,
      );
      return;
    }
    setError(undefined);
    setPhase("submitting");
    try {
      // Real path: strk20InvokeTransaction (deposit / withdraw) via the
      // connected wallet. Demo mode simulates.
      const submit = shielding ? onShield : onUnshield;
      const res = await (submit
        ? submit(value)
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
      <Done
        title={shielding ? "Shielded" : "Unshielded"}
        detail={
          shielding
            ? `${formatAmount(done.amount)} ${token} moved to your private balance. It becomes spendable in about 5 minutes.`
            : `${formatAmount(done.amount)} ${token} moved back to your public balance.`
        }
        txHash={done.txHash}
        onDone={onBack}
      />
    );
  }

  const busy = phase === "submitting";

  return (
    <div className="flex flex-1 flex-col gap-7 py-6">
      <SubHeader title={shielding ? "Shield" : "Unshield"} onBack={onBack} />

      <div className="grid grid-cols-2 gap-1 rounded-full bg-surface p-1 ring-1 ring-border">
        {(["shield", "unshield"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              setError(undefined);
              setAmount("");
            }}
            className={`h-9 rounded-full text-[13px] font-semibold capitalize transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              mode === m
                ? "bg-surface-2 text-fg ring-1 ring-border-strong"
                : "text-muted hover:text-fg"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <p className="px-1 text-[14px] leading-6 text-muted">
        {shielding
          ? `Move ${token} from your public balance into your private one. Once shielded, balances and payments are hidden on-chain.`
          : `Move ${token} from your private balance back to your public one. Unshielded funds are visible on-chain again.`}
      </p>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between px-1">
            <label htmlFor={amountId} className="text-[13px] font-medium text-muted">
              Amount
            </label>
            <span className="text-[12px] text-faint">
              {shielding ? "Public balance:" : "Private balance:"}{" "}
              <span className="font-mono tabular-nums">
                {formatAmount(available)} {token}
              </span>
            </span>
          </div>
          <div className="relative">
            <input
              id={amountId}
              name="amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              disabled={busy}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${amountId}-error` : undefined}
              className="h-13 w-full rounded-2xl bg-surface pl-4 pr-24 font-mono text-[15px] tabular-nums text-fg ring-1 ring-border transition-shadow duration-150 placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="absolute inset-y-0 right-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAmount(String(maxMove))}
                disabled={busy}
                className="flex h-8 items-center rounded-full bg-surface-2 px-3 text-[12px] font-semibold text-accent transition-colors duration-150 hover:bg-accent hover:text-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Max
              </button>
              <span className="text-[14px] font-medium text-muted">{token}</span>
            </div>
          </div>
          {error && (
            <p id={`${amountId}-error`} className="px-1 text-[13px] text-danger">
              {error}
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3">
          <p className="text-center text-[12px] text-faint">
            {feeStrk > 0 ? `Network fee: ${feeStrk} STRK · ` : ""}
            {shielding
              ? "Shielded funds become spendable after ~5 minutes."
              : "Unshielded funds are publicly visible again."}
          </p>
          <PrimaryButton type="submit" busy={busy}>
            {busy
              ? shielding
                ? "Shielding…"
                : "Unshielding…"
              : `${shielding ? "Shield" : "Unshield"} ${token}`}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}
