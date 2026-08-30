"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  Copy,
  Shield,
  ShieldPlus,
  Spinner,
  KairoMark,
} from "@/components/icons";
import { MOCK_WALLET, type ActivityItem } from "@/lib/mock";
import { formatAmount, splitAmount, truncateAddress } from "@/lib/format";
import {
  startWalletDiscovery,
  useWalletStore,
} from "@/lib/wallet-store";
import { POOL_FEE_STRK, canReceivePrivately } from "@/lib/chain";
import { ReceiveScreen, SendScreen, ShieldScreen } from "@/components/screens";
import { SetupCard, StatusNotice } from "@/components/status-notice";

/** ?demo=1 → wallet view on mock data; ?demo=unregistered → first-use setup state. */
type DemoMode = "" | "on" | "unregistered";

export default function Home() {
  const status = useWalletStore((s) => s.status);
  // Demo modes render without a wallet round-trip — for UI work and the demo
  // video. Set in an effect to stay SSR-safe.
  const [demo, setDemo] = useState<DemoMode>("");

  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("demo");
    setDemo(v === null ? "" : v === "unregistered" ? "unregistered" : "on");
    // Wallet-standard discovery: wallets announce themselves after load.
    return startWalletDiscovery();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col px-5">
      {status === "connected" || demo ? <Wallet demo={demo} /> : <Connect />}
    </main>
  );
}

/* ---------------------------------------------------------------- Connect */

const READY_INSTALL_URL = "https://www.ready.co/download";

function Connect() {
  const { wallets, status, error, connect } = useWalletStore();
  const connecting = status === "connecting";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 py-16 text-center">
      <div className="flex flex-col items-center gap-5">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-surface text-accent ring-1 ring-border">
          <KairoMark size={26} />
        </span>
        <div className="space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">Kairo</h1>
          <p className="max-w-[18rem] text-[15px] leading-6 text-muted">
            Receive, hold, and send privately on Starknet. The cryptography
            stays hidden.
          </p>
        </div>
      </div>

      <div className="flex w-full flex-col items-center gap-4">
        {wallets.length > 0 ? (
          <ul className="flex w-full flex-col gap-2.5">
            {wallets.map((w) => (
              <li key={w.name}>
                <button
                  type="button"
                  onClick={() => connect(w)}
                  disabled={connecting}
                  className="flex h-13 w-full items-center gap-3 rounded-2xl bg-surface px-4 text-left ring-1 ring-border transition-colors duration-150 hover:bg-surface-2 hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
                >
                  {w.icon ? (
                    // Wallet icons are data: URIs from wallet-standard.
                    <Image
                      src={w.icon}
                      alt=""
                      width={28}
                      height={28}
                      className="size-7 rounded-lg"
                      unoptimized
                    />
                  ) : (
                    <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-faint ring-1 ring-border">
                      <Shield size={14} />
                    </span>
                  )}
                  <span className="flex-1 text-[15px] font-medium">
                    {w.name}
                  </span>
                  {connecting ? (
                    <Spinner size={16} className="text-faint" />
                  ) : (
                    <span className="text-[13px] text-faint">Connect</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <NoWallet />
        )}

        {status === "error" && error && (
          <p role="alert" className="max-w-[20rem] text-[13px] leading-5 text-danger">
            {error}
          </p>
        )}

        <p className="text-xs text-faint">
          Private by default · powered by the STRK20 pool
        </p>
      </div>
    </div>
  );
}

function NoWallet() {
  return (
    <div className="flex w-full flex-col items-center gap-3 rounded-card bg-surface/50 px-6 py-7 ring-1 ring-border">
      <p className="text-[14px] font-medium">No Starknet wallet found</p>
      <p className="max-w-[17rem] text-[13px] leading-5 text-faint">
        Kairo needs a wallet that supports private balances. Install Ready, then
        reload this page.
      </p>
      <a
        href={READY_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex h-10 items-center rounded-full bg-accent px-5 text-[14px] font-semibold text-bg transition-colors duration-150 hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
      >
        Get Ready wallet
      </a>
    </div>
  );
}

/* ----------------------------------------------------------------- Wallet */

type View = "home" | "receive" | "send" | "shield";

function Wallet({ demo = "" }: { demo?: DemoMode }) {
  const {
    address,
    walletName,
    isMainnet,
    strk20,
    disconnect,
    shielded: realShielded,
    publicStrk: realPublic,
    sendPrivate,
    shield,
    unshield,
    refresh,
  } = useWalletStore();
  const [view, setView] = useState<View>("home");

  // Real data when actually connected; mock only in demo modes.
  // TODO(wiring): real activity comes from pool events; real pending needs
  // note-level maturity data the Wallet API doesn't expose yet.
  const real = !demo;
  const demoUnreg = demo === "unregistered";
  const shielded = real
    ? strk20 === "supported"
      ? (realShielded ?? 0)
      : 0
    : demoUnreg
      ? 0
      : MOCK_WALLET.shielded;
  const pending = real || demoUnreg ? 0 : MOCK_WALLET.pending;
  const publicStrk = real ? (realPublic ?? 0) : MOCK_WALLET.publicStrk;
  const activity = real || demoUnreg ? [] : MOCK_WALLET.activity;
  const token = MOCK_WALLET.token;
  const { int, frac } = splitAmount(shielded);

  const showSetup =
    demoUnreg || (real && isMainnet && strk20 === "unregistered");

  // Own-address receivability — derived from the probe, no extra RPC needed.
  const receivable =
    demo === "on"
      ? true
      : demoUnreg
        ? false
        : strk20 === "supported"
          ? true
          : strk20 === "unregistered"
            ? false
            : undefined; // unknown → ReceiveScreen fails open

  const displayAddress = demo ? MOCK_WALLET.address : (address ?? "");
  const back = () => setView("home");

  if (view === "receive") {
    return (
      <ReceiveScreen
        address={displayAddress}
        onBack={back}
        receivable={receivable}
      />
    );
  }
  if (view === "send") {
    return (
      <SendScreen
        spendable={shielded}
        token={token}
        feeStrk={POOL_FEE_STRK}
        onBack={back}
        onSubmit={real ? sendPrivate : undefined}
        checkRecipient={real ? canReceivePrivately : undefined}
      />
    );
  }
  if (view === "shield") {
    return (
      <ShieldScreen
        publicBalance={publicStrk}
        shieldedBalance={shielded}
        token={token}
        feeStrk={POOL_FEE_STRK}
        onBack={back}
        onShield={real ? shield : undefined}
        onUnshield={real ? unshield : undefined}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-7 py-6">
      <Header address={displayAddress} onDisconnect={disconnect} />

      {showSetup ? (
        <SetupCard
          walletName={walletName}
          onCheck={
            real
              ? refresh
              : async () => {
                  // Demo: simulate the re-probe round-trip.
                  await new Promise((r) => setTimeout(r, 900));
                }
          }
        />
      ) : (
        real &&
        (!isMainnet || strk20 !== "supported") && (
          <StatusNotice
            isMainnet={isMainnet}
            strk20={strk20}
            walletName={walletName}
          />
        )
      )}

      {/* Balance */}
      <section className="relative overflow-hidden rounded-card bg-surface px-6 pb-7 pt-6 ring-1 ring-border">
        <div className="kairo-glow pointer-events-none absolute inset-x-0 top-0 h-28" />
        <div className="relative flex flex-col gap-3">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <Shield size={14} className="text-accent" />
            Shielded balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[44px] font-semibold leading-none tracking-tight tabular-nums">
              {int}
              {frac && <span className="text-muted">.{frac}</span>}
            </span>
            <span className="text-lg font-medium text-muted">{token}</span>
          </div>
          {pending > 0 && (
            <p className="flex items-center gap-2 text-[13px] text-muted">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-success motion-safe:animate-pulse"
              />
              <span className="font-mono tabular-nums">
                +{formatAmount(pending)} {token}
              </span>
              arriving · spendable in ~5 min
            </p>
          )}
        </div>
      </section>

      {/* Actions */}
      <section className="grid grid-cols-3 gap-3">
        <Action
          label="Receive"
          icon={<ArrowDownLeft size={20} />}
          onClick={() => setView("receive")}
        />
        <Action
          label="Send"
          icon={<ArrowUpRight size={20} />}
          onClick={() => setView("send")}
        />
        <Action
          label="Shield"
          icon={<ShieldPlus size={20} />}
          onClick={() => setView("shield")}
        />
      </section>

      {/* Activity */}
      <section className="flex flex-1 flex-col gap-3">
        <h2 className="px-1 text-[13px] font-medium text-muted">Activity</h2>
        {activity.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {activity.map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        ) : (
          <EmptyActivity />
        )}
      </section>
    </div>
  );
}

function Header({
  address,
  onDisconnect,
}: {
  address: string;
  onDisconnect: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard?.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <header className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        <KairoMark size={20} className="text-accent" />
        Kairo
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex h-9 items-center gap-2 rounded-full bg-surface px-3 font-mono text-[13px] text-muted ring-1 ring-border transition-colors duration-150 hover:text-fg hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={copied ? "Address copied" : "Copy your address"}
        >
          {truncateAddress(address)}
          {copied ? (
            <Check size={14} className="text-success" />
          ) : (
            <Copy size={14} />
          )}
        </button>
        <button
          type="button"
          onClick={onDisconnect}
          className="flex h-9 items-center rounded-full px-3 text-[13px] text-faint transition-colors duration-150 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          Disconnect
        </button>
      </div>
    </header>
  );
}

function Action({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-2.5 rounded-2xl bg-surface py-4 ring-1 ring-border transition-colors duration-150 hover:bg-surface-2 hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="flex size-10 items-center justify-center rounded-full bg-surface-2 text-accent ring-1 ring-border transition-colors duration-150 group-hover:bg-accent group-hover:text-bg">
        {icon}
      </span>
      <span className="text-[13px] font-medium">{label}</span>
    </button>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const received = item.kind === "received" || item.kind === "unshield";
  const meta = ACTIVITY_META[item.kind];
  const { int, frac } = splitAmount(item.amount);

  return (
    <li>
      <div className="flex items-center gap-3 rounded-2xl px-1.5 py-2.5 transition-colors duration-150 hover:bg-surface">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-muted ring-1 ring-border">
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{meta.label}</p>
          <p className="truncate text-[12px] text-faint">
            {item.peer ? item.peer : item.at}
            {item.peer && <span className="text-faint"> · {item.at}</span>}
          </p>
        </div>
        <span
          className={`shrink-0 font-mono text-[14px] font-medium tabular-nums ${
            received ? "text-success" : "text-fg"
          }`}
        >
          {received ? "+" : "−"}
          {int}
          {frac && <span className="opacity-60">.{frac}</span>} {item.token}
        </span>
      </div>
    </li>
  );
}

const ACTIVITY_META: Record<
  ActivityItem["kind"],
  { label: string; icon: React.ReactNode }
> = {
  received: { label: "Received privately", icon: <ArrowDownLeft size={16} /> },
  sent: { label: "Sent privately", icon: <ArrowUpRight size={16} /> },
  shield: { label: "Shielded", icon: <ShieldPlus size={16} /> },
  unshield: { label: "Unshielded", icon: <ArrowUpRight size={16} /> },
};

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card bg-surface/50 px-6 py-10 text-center ring-1 ring-border">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-faint ring-1 ring-border">
        <Shield size={20} />
      </span>
      <p className="text-[14px] font-medium">No activity yet</p>
      <p className="max-w-[15rem] text-[13px] leading-5 text-faint">
        Share your receive address to get paid privately, or shield some STRK to
        get started.
      </p>
    </div>
  );
}
