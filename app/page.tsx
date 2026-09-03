"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import {
  Shield,
  ShieldPlus,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowDownLeft,
  Sparkles,
} from "@/components/icons";
import { MOCK_WALLET, type ActivityItem } from "@/lib/mock";
import { relativeTime } from "@/lib/format";
import {
  startWalletDiscovery,
  useWalletStore,
} from "@/lib/wallet-store";
import { POOL_FEE_STRK, SEPOLIA_CHAIN_ID, canReceivePrivately } from "@/lib/chain";
import { Navbar, type NavTab } from "@/components/navbar";
import { WalletModal } from "@/components/wallet-modal";
import { PoolStats } from "@/components/pool-stats";
import {
  DashboardTab,
  ShieldTab,
  TransferTab,
  UnshieldTab,
  ReceiveTab,
  ActivityTab,
} from "@/components/screens";
import { SetupCard, StatusNotice } from "@/components/status-notice";

/** ?demo=1 → wallet view on sample data; ?demo=unregistered → first-use setup state. */
type DemoMode = "" | "on" | "unregistered";

function getInitialDemo(): DemoMode {
  if (typeof window === "undefined") return "";
  const v = new URLSearchParams(window.location.search).get("demo");
  return v === null ? "" : v === "unregistered" ? "unregistered" : "on";
}

/** Cached clock for pending-note maturity. getSnapshot must return a stable
 *  value between ticks — `Date.now()` on every read loops in React 19. */
let cachedNow = 0;

function subscribeTime(callback: () => void) {
  cachedNow = Date.now();
  const interval = setInterval(() => {
    cachedNow = Date.now();
    callback();
  }, 15000);
  return () => clearInterval(interval);
}

function getNow() {
  if (!cachedNow) cachedNow = Date.now();
  return cachedNow;
}

function getServerNow() {
  return 0;
}

export default function Home() {
  const {
    address,
    walletName,
    walletIcon,
    status,
    isMainnet,
    chainId,
    strk20,
    wallets,
    shielded: realShielded,
    publicStrk: realPublic,
    sendPrivate,
    shield,
    unshield,
    refresh,
    connect,
    disconnect,
    error,
    history,
  } = useWalletStore();

  const [activeTab, setActiveTab] = useState<NavTab>("dashboard");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [demo, setDemo] = useState<DemoMode>(getInitialDemo);

  useEffect(() => {
    setDemo(getInitialDemo());
  }, []);

  const now = useSyncExternalStore(subscribeTime, getNow, getServerNow);

  useEffect(() => {
    return startWalletDiscovery();
  }, []);

  const real = !demo;
  const isConnected = status === "connected" || Boolean(demo);
  const demoUnreg = demo === "unregistered";

  const shielded = real
    ? strk20 === "supported"
      ? (realShielded ?? 0)
      : 0
    : demoUnreg
      ? 0
      : MOCK_WALLET.shielded;

  const pending = useMemo(() => {
    if (!real) return demoUnreg ? 0 : MOCK_WALLET.pending;
    if (!now) return 0;
    return history
      .filter((h) => h.kind === "shield" && now - h.ts < 5 * 60_000)
      .reduce((sum, h) => sum + h.amount, 0);
  }, [real, demoUnreg, history, now]);

  const publicStrk = real ? (realPublic ?? 0) : MOCK_WALLET.publicStrk;

  const activity: ActivityItem[] = useMemo(() => {
    if (!real) return demoUnreg ? [] : MOCK_WALLET.activity;
    return history.map((h) => ({
      id: h.txHash,
      kind: h.kind,
      amount: h.amount,
      token: MOCK_WALLET.token,
      peer: h.kind === "sent" ? "private" : undefined,
      at: relativeTime(h.ts),
    }));
  }, [real, demoUnreg, history, now]);

  const token = MOCK_WALLET.token;
  const displayAddress = demo ? MOCK_WALLET.address : (address ?? "");
  const showSetup =
    demoUnreg ||
    (real && isConnected && strk20 === "unregistered");

  // While waiting on first-use registration, poll the pool
  useEffect(() => {
    if (!(real && isConnected && strk20 === "unregistered" && address)) return;
    const network = chainId === SEPOLIA_CHAIN_ID ? "sepolia" : "mainnet";
    const id = setInterval(async () => {
      if (await canReceivePrivately(address, network)) {
        clearInterval(id);
        void refresh();
      }
    }, 5000);
    return () => clearInterval(id);
  }, [real, isConnected, strk20, address, chainId, refresh]);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connected={isConnected}
        address={displayAddress}
        walletIcon={walletIcon}
        isMainnet={real ? isMainnet : true}
        shieldedBalance={shielded}
        token={token}
        onConnectClick={() => setWalletModalOpen(true)}
        onDisconnect={demo ? () => setDemo("") : disconnect}
        onRefresh={real ? refresh : undefined}
        demo={demo}
      />

      {/* Main Container */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* First time setup banner if unregistered */}
        {showSetup && activeTab !== "shield" && (
          <div className="mb-8">
            <SetupCard
              walletName={walletName}
              onCheck={
                real
                  ? refresh
                  : async () => {
                      await new Promise((r) => setTimeout(r, 800));
                      return true;
                    }
              }
            />
          </div>
        )}

        {/* Real wallet notice if not on mainnet */}
        {real && isConnected && (!isMainnet || strk20 !== "supported") && !showSetup && (
          <div className="mb-6">
            <StatusNotice
              isMainnet={isMainnet}
              strk20={strk20}
              walletName={walletName}
            />
          </div>
        )}

        {/* Unconnected Welcome Hero (if not connected and no demo) */}
        {!isConnected ? (
          <div className="mx-auto max-w-2xl py-12 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-3xl bg-surface-2 text-accent ring-1 ring-border shadow-[0_0_40px_rgba(157,140,255,0.25)]">
              <Shield size={32} />
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl text-fg">
              The Private Wallet for Starknet
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Receive, hold, and send privately on Starknet with zero cryptography jargon. Powered by the live STRK20 Privacy Pool.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setWalletModalOpen(true)}
                className="flex h-13 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-accent px-8 text-[15px] font-semibold text-bg transition-all hover:bg-accent-strong hover:shadow-[0_0_25px_rgba(157,140,255,0.4)]"
              >
                Connect Starknet Wallet
              </button>
              <button
                type="button"
                onClick={() => setDemo("on")}
                className="flex h-13 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-surface px-6 text-[14px] font-semibold text-fg ring-1 ring-border transition-colors hover:bg-surface-2"
              >
                <Sparkles size={15} className="text-accent" /> Launch Demo Mode
              </button>
            </div>

            {/* Feature Highlights */}
            <div className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-3 text-left">
              {[
                {
                  title: "Shielded Pool",
                  desc: "Deposits enter an unlinkable privacy pool backed by Cairo ZK-STARKs.",
                },
                {
                  title: "Stealth Receiving",
                  desc: "Publish your privacy address once. Payments discover automatically.",
                },
                {
                  title: "Gasless Relayers",
                  desc: "AVNU Paymaster submits transactions so your address never leaks in calldata.",
                },
              ].map((f) => (
                <div key={f.title} className="rounded-3xl bg-surface/70 p-5 ring-1 ring-border backdrop-blur-md">
                  <h3 className="text-[14px] font-semibold text-fg">{f.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-faint">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Connected Application Tabs Layout */
          <div>
            {activeTab === "dashboard" && (
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <DashboardTab
                    shielded={shielded}
                    publicBalance={publicStrk}
                    pending={pending}
                    token={token}
                    address={displayAddress}
                    activity={activity}
                    onNavigate={(tab) => setActiveTab(tab)}
                    showSetup={showSetup}
                  />
                </div>
                <div className="lg:col-span-1">
                  <PoolStats
                    shieldedBalance={shielded}
                    publicBalance={publicStrk}
                    isRegistered={strk20 === "supported" || demo === "on"}
                  />
                </div>
              </div>
            )}

            {activeTab === "shield" &&
              (showSetup ? (
                <div className="mx-auto max-w-xl">
                  <SetupCard
                    walletName={walletName}
                    onCheck={
                      real
                        ? refresh
                        : async () => {
                            await new Promise((r) => setTimeout(r, 800));
                            return true;
                          }
                    }
                  />
                </div>
              ) : (
                <ShieldTab
                  publicBalance={publicStrk}
                  token={token}
                  feeStrk={POOL_FEE_STRK}
                  onShield={real ? shield : undefined}
                />
              ))}

            {activeTab === "transfer" && (
              <TransferTab
                spendable={shielded}
                token={token}
                feeStrk={POOL_FEE_STRK}
                onSubmit={real ? sendPrivate : undefined}
                checkRecipient={
                  real
                    ? (addr) =>
                        canReceivePrivately(
                          addr,
                          chainId === SEPOLIA_CHAIN_ID ? "sepolia" : "mainnet",
                        )
                    : undefined
                }
              />
            )}

            {activeTab === "unshield" && (
              <UnshieldTab
                shieldedBalance={shielded}
                token={token}
                feeStrk={POOL_FEE_STRK}
                onUnshield={real ? unshield : undefined}
              />
            )}

            {activeTab === "receive" && (
              <ReceiveTab
                address={displayAddress}
                receivable={strk20 === "supported" || demo === "on"}
              />
            )}

            {activeTab === "activity" && (
              <ActivityTab activity={activity} token={token} />
            )}
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {isConnected && (
        <div className="sticky bottom-0 z-40 w-full border-t border-border/80 bg-bg/90 backdrop-blur-xl md:hidden">
          <div className="flex h-16 items-center justify-around px-2">
            {[
              { id: "dashboard", label: "Overview", icon: Shield },
              { id: "shield", label: "Shield", icon: ShieldPlus },
              { id: "transfer", label: "Send", icon: ArrowUpRight },
              { id: "unshield", label: "Unshield", icon: ArrowLeftRight },
              { id: "receive", label: "Receive", icon: ArrowDownLeft },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as NavTab)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-1.5 transition-colors ${
                    active ? "text-accent font-semibold" : "text-muted hover:text-fg"
                  }`}
                >
                  <Icon size={18} className={active ? "text-accent" : "text-muted"} />
                  <span className="text-[10px]">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Connect Wallet Modal */}
      <WalletModal
        open={walletModalOpen}
        onClose={() => setWalletModalOpen(false)}
        wallets={wallets}
        connecting={status === "connecting"}
        onConnect={(w) => {
          setWalletModalOpen(false);
          void connect(w);
        }}
        error={error}
        onSelectDemo={() => setDemo("on")}
      />
    </div>
  );
}
