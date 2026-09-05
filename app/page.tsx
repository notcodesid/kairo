"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import {
  Shield,
  ShieldPlus,
  ArrowUpRight,
  ArrowLeftRight,
  ArrowDownLeft,
  Sparkles,
  KairoMark,
} from "@/components/icons";
import { MOCK_WALLET, type ActivityItem } from "@/lib/mock";
import { relativeTime } from "@/lib/format";
import {
  startWalletDiscovery,
  useWalletStore,
} from "@/lib/wallet-store";
import { initSdkStore, startSdkPolling, useSdkStore } from "@/lib/sdk-store";
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
import { SdkSetupCard } from "@/components/sdk-setup";

/** Which party holds the viewing key: the wallet (Ready) or Kairo itself. */
export type KeyRoute = "wallet" | "sdk";

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
  const [route, setRoute] = useState<KeyRoute>("wallet");

  const sdk = useSdkStore();

  useEffect(() => {
    setDemo(getInitialDemo());
  }, []);

  const now = useSyncExternalStore(subscribeTime, getNow, getServerNow);

  useEffect(() => {
    return startWalletDiscovery();
  }, []);

  useEffect(() => {
    initSdkStore();
  }, []);

  const sdkMode = route === "sdk";
  const sdkReady = sdk.status === "ready" && Boolean(sdk.address);

  const real = !demo && !sdkMode;
  const isConnected = sdkMode ? sdkReady : status === "connected" || Boolean(demo);
  const demoUnreg = demo === "unregistered" && !sdkMode;

  const shielded = sdkMode
    ? sdk.registered
      ? (sdk.shielded ?? 0)
      : 0
    : real
      ? strk20 === "supported"
        ? (realShielded ?? 0)
        : 0
      : demoUnreg
        ? 0
        : MOCK_WALLET.shielded;

  const pending = useMemo(() => {
    if (sdkMode) {
      if (!now) return 0;
      return sdk.history
        .filter((h) => h.kind === "shield" && now - h.ts < 5 * 60_000)
        .reduce((sum, h) => sum + h.amount, 0);
    }
    if (!real) return demoUnreg ? 0 : MOCK_WALLET.pending;
    if (!now) return 0;
    return history
      .filter((h) => h.kind === "shield" && now - h.ts < 5 * 60_000)
      .reduce((sum, h) => sum + h.amount, 0);
  }, [sdkMode, sdk.history, real, demoUnreg, history, now]);

  const publicStrk = sdkMode
    ? (sdk.publicStrk ?? 0)
    : real
      ? (realPublic ?? 0)
      : MOCK_WALLET.publicStrk;

  const activity: ActivityItem[] = useMemo(() => {
    if (sdkMode) {
      return sdk.history.map((h) => ({
        id: h.txHash,
        kind: h.kind === "sent" ? "sent" : h.kind,
        amount: h.amount,
        token: MOCK_WALLET.token,
        peer: h.kind === "sent" ? "private" : undefined,
        at: relativeTime(h.ts),
      }));
    }
    if (!real) return demoUnreg ? [] : MOCK_WALLET.activity;
    return history.map((h) => ({
      id: h.txHash,
      kind: h.kind,
      amount: h.amount,
      token: MOCK_WALLET.token,
      peer: h.kind === "sent" ? "private" : undefined,
      at: relativeTime(h.ts),
    }));
  }, [sdkMode, sdk.history, real, demoUnreg, history, now]);

  const token = MOCK_WALLET.token;
  const displayAddress = sdkMode
    ? (sdk.address ?? "")
    : demo
      ? MOCK_WALLET.address
      : (address ?? "");
  const showSetup = sdkMode
    ? sdkReady && !sdk.registered
    : demoUnreg || (real && isConnected && strk20 === "unregistered");

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

  // Background discovery polling for the SDK route (visible tab only).
  useEffect(() => {
    if (!(sdkMode && sdkReady && sdk.registered)) return;
    return startSdkPolling();
  }, [sdkMode, sdkReady, sdk.registered]);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        connected={isConnected}
        address={displayAddress}
        walletIcon={sdkMode ? undefined : walletIcon}
        isMainnet={sdkMode ? sdk.network === "mainnet" : real ? isMainnet : true}
        shieldedBalance={shielded}
        token={token}
        onConnectClick={
          sdkMode ? () => setActiveTab("dashboard") : () => setWalletModalOpen(true)
        }
        onDisconnect={sdkMode ? sdk.forget : demo ? () => setDemo("") : disconnect}
        onRefresh={sdkMode ? sdk.refresh : real ? refresh : undefined}
        demo={sdkMode ? "" : demo}
        mode={route}
        onModeChange={(m) => {
          setRoute(m);
          setActiveTab("dashboard");
        }}
        connectLabel={sdkMode ? "Get started" : "Connect Wallet"}
        disconnectLabel={sdkMode ? "Forget SDK key" : "Disconnect Wallet"}
      />

      {/* Main Container */}
      <main className="mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Route switch for small screens (navbar switch is sm+) */}
        <div className="mb-6 flex justify-center sm:hidden">
          <div className="flex items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-border">
            {(
              [
                { id: "wallet", label: "Wallet" },
                { id: "sdk", label: "SDK key" },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setRoute(m.id);
                  setActiveTab("dashboard");
                }}
                className={`rounded-full px-4 py-1.5 text-[12px] font-medium transition-all ${
                  route === m.id
                    ? "bg-black font-semibold text-white ring-1 ring-black shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* First time setup banner if unregistered */}
        {showSetup && activeTab !== "shield" && (
          <div className="mb-8">
            {sdkMode ? (
              <SdkSetupCard />
            ) : (
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
            )}
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
        {/* Unconnected: wallet hero, or SDK setup when on the SDK route */}
        {!isConnected ? (
          sdkMode ? (
            <div className="mx-auto max-w-xl py-4">
              <SdkSetupCard />
            </div>
          ) : (
          <div className="mx-auto max-w-2xl py-12 text-center">
            <div className="inline-flex size-16 items-center justify-center rounded-3xl bg-surface-2 text-fg ring-1 ring-border shadow-sm">
              <KairoMark size={34} />
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
                className="flex h-13 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-black px-8 text-[15px] font-semibold text-white shadow-sm transition-all hover:bg-zinc-800"
              >
                Connect Starknet Wallet
              </button>
              <button
                type="button"
                onClick={() => setDemo("on")}
                className="flex h-13 w-full sm:w-auto items-center justify-center gap-2 rounded-2xl bg-surface px-6 text-[14px] font-semibold text-fg ring-1 ring-border transition-colors hover:bg-surface-2"
              >
                <Sparkles size={15} className="text-fg" /> Launch Demo Mode
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
                <div key={f.title} className="rounded-3xl bg-surface p-5 ring-1 ring-border shadow-sm">
                  <h3 className="text-[14px] font-semibold text-fg">{f.title}</h3>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
          )
        ) : sdkMode && !sdk.registered && activeTab !== "dashboard" ? (
          /* SDK route gates every action tab behind viewing-key registration */
          <div className="mx-auto max-w-xl">
            <SdkSetupCard />
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
                    isRegistered={
                      sdkMode
                        ? sdk.registered
                        : strk20 === "supported" || demo === "on"
                    }
                  />
                </div>
              </div>
            )}

            {activeTab === "shield" &&
              (showSetup ? (
                <div className="mx-auto max-w-xl">
                  {sdkMode ? (
                    <SdkSetupCard />
                  ) : (
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
                  )}
                </div>
              ) : (
                <ShieldTab
                  publicBalance={publicStrk}
                  token={token}
                  feeStrk={sdkMode ? sdk.feeStrk : POOL_FEE_STRK}
                  onShield={sdkMode ? sdk.shield : real ? shield : undefined}
                />
              ))}

            {activeTab === "transfer" && (
              <TransferTab
                spendable={shielded}
                token={token}
                feeStrk={sdkMode ? sdk.feeStrk : POOL_FEE_STRK}
                onSubmit={sdkMode ? sdk.sendPrivate : real ? sendPrivate : undefined}
                checkRecipient={
                  sdkMode
                    ? sdk.checkRecipient
                    : real
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
                feeStrk={sdkMode ? sdk.feeStrk : POOL_FEE_STRK}
                onUnshield={sdkMode ? sdk.unshield : real ? unshield : undefined}
              />
            )}

            {activeTab === "receive" && (
              <ReceiveTab
                address={displayAddress}
                receivable={
                  sdkMode ? sdk.registered : strk20 === "supported" || demo === "on"
                }
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
        <div className="sticky bottom-0 z-40 w-full border-t border-border bg-bg/95 backdrop-blur-xl md:hidden">
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
                    active ? "text-fg font-semibold" : "text-muted hover:text-fg"
                  }`}
                >
                  <Icon size={18} className={active ? "text-fg" : "text-muted"} />
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
