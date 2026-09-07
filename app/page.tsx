"use client";

import Image from "next/image";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MOCK_WALLET, type ActivityItem } from "@/lib/mock";
import { relativeTime } from "@/lib/format";
import {
  startWalletDiscovery,
  reconnectWallet,
  startWalletPolling,
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
  SwapTab,
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

const NAV_TABS = [
  { id: "shield", label: "Shield" },
  { id: "transfer", label: "Private Send" },
  { id: "swap", label: "Private Swap" },
  { id: "unshield", label: "Unshield" },
] as const;

function NavigationTabs({
  activeTab,
  onSelect,
}: {
  activeTab: NavTab;
  onSelect: (tab: NavTab) => void;
}) {
  return (
    <nav className="inline-flex items-center gap-1 sm:gap-2 relative">
      {NAV_TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id as NavTab)}
            className={`relative rounded-full px-5 py-2 text-[14px] sm:text-[15px] font-semibold transition-colors duration-150 focus-visible:outline-none ${
              active
                ? "text-white"
                : "text-[#52525b] hover:text-fg"
            }`}
          >
            {active && (
              <motion.span
                layoutId="activeTabIndicator"
                className="absolute inset-0 rounded-full strk-pill-active"
                transition={{ type: "spring", stiffness: 450, damping: 32 }}
              />
            )}
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
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

  const [activeTab, setActiveTab] = useState<NavTab>("shield");
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [demo, setDemo] = useState<DemoMode>("");
  // Client-only: the ?demo param doesn't exist during SSR — sync after mount
  // so the first client render matches the server HTML (no hydration mismatch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only convergence to SSR value or ?demo param
    setDemo(getInitialDemo());
  }, []);
  const [route, setRoute] = useState<KeyRoute>("wallet");

  const sdk = useSdkStore();

  const now = useSyncExternalStore(subscribeTime, getNow, getServerNow);

  useEffect(() => {
    const stopDiscovery = startWalletDiscovery();
    void reconnectWallet();
    return stopDiscovery;
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

  // Live balances for the wallet route: refresh every 10s while connected so
  // shield / send / swap / unshield show up without a manual reload.
  useEffect(() => {
    if (status !== "connected") return;
    return startWalletPolling();
  }, [status]);

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg relative overflow-x-clip">

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
        onConnectClick={() => setWalletModalOpen(true)}
        onDisconnect={sdkMode ? sdk.forget : demo ? () => setDemo("") : disconnect}
        onRefresh={sdkMode ? sdk.refresh : real ? refresh : undefined}
        demo={sdkMode ? "" : demo}
        mode={route}
        connectLabel="Get started"
        disconnectLabel={sdkMode ? "Forget SDK key" : "Disconnect Wallet"}
      />

      {/* Ambient Decorative Objects (Acctual-style desktop frame) */}
      {/* Top-Right: Peeking MacBook (~15% visible) */}
      <div className="pointer-events-none select-none absolute -top-10 lg:-top-14 xl:-top-16 -right-[460px] lg:-right-[520px] xl:-right-[580px] 2xl:-right-[620px] z-0 hidden lg:block dark:opacity-20 dark:brightness-100 dark:grayscale dark:mix-blend-screen transition-opacity">
        <div
          style={{ transform: "rotate(-15deg)" }}
          className="w-[660px] lg:w-[720px] xl:w-[780px] 2xl:w-[820px] drop-shadow-[5px_2px_6px_rgba(0,0,0,0.06)] drop-shadow-[21px_9px_10px_rgba(0,0,0,0.08)] drop-shadow-[48px_20px_18px_rgba(0,0,0,0.06)]"
        >
          <Image
            src="/laptop.png"
            alt="MacBook Pro"
            width={1024}
            height={912}
            priority
            className="h-auto w-full object-contain"
          />
        </div>
      </div>

      {/* Top-Left Ambient Elements (Peeking naturally, no flip, showing more items) */}
      <div className="pointer-events-none select-none absolute top-28 lg:top-32 xl:top-36 2xl:top-40 -left-28 lg:-left-36 xl:-left-44 2xl:-left-40 z-0 hidden lg:block dark:opacity-25 dark:brightness-90 transition-opacity">
        <div
          style={{ transform: "rotate(-40deg)" }}
          className="w-[480px] lg:w-[540px] xl:w-[600px] 2xl:w-[650px] drop-shadow-[0_20px_36px_rgba(0,0,0,0.08)]"
        >
          <Image
            src="/paperclip.png"
            alt="Ambient elements"
            width={1024}
            height={640}
            priority
            className="h-auto w-full object-contain"
          />
        </div>
      </div>

      {/* Bottom-Left: Peeking Magic Keyboard (Acctual-style corner peek) */}
      <div className="pointer-events-none select-none absolute -bottom-6 lg:-bottom-8 xl:-bottom-10 -left-6 lg:-left-8 xl:-left-6 2xl:-left-2 z-0 hidden lg:block dark:opacity-20 dark:brightness-100 dark:grayscale dark:mix-blend-screen transition-opacity">
        <div
          className="w-[320px] lg:w-[380px] xl:w-[440px] 2xl:w-[480px] drop-shadow-[0_20px_40px_rgba(0,0,0,0.10)]"
        >
          <Image
            src="/keyboard.png"
            alt="Keyboard"
            width={1002}
            height={596}
            priority
            className="h-auto w-full object-contain"
          />
        </div>
      </div>

      {/* Bottom-Right: Orange Binder Clip with Cast Shadow */}
      <div className="pointer-events-none select-none absolute bottom-16 right-8 lg:right-16 xl:right-28 2xl:right-40 z-0 hidden lg:block dark:opacity-40 transition-opacity">
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
          className="w-[80px] lg:w-[95px] xl:w-[110px] 2xl:w-[125px] drop-shadow-[0_14px_24px_rgba(0,0,0,0.12)]"
        >
          <Image
            src="/clip.png"
            alt="Binder clip"
            width={416}
            height={437}
            className="h-auto w-full object-contain"
          />
        </motion.div>
      </div>

      {/* Main Container */}
      <main id="kairo-app" className="relative z-10 mx-auto flex-1 w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

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
        <AnimatePresence mode="wait">
          {real && isConnected && (!isMainnet || strk20 !== "supported") && !showSetup && (
            <motion.div
              key="wallet-status"
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="mb-6 flex justify-center"
            >
              <StatusNotice
                isMainnet={isMainnet}
                strk20={strk20}
                walletName={walletName}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Heading and Subtitle */}
        <div className="mx-auto max-w-2xl text-center pt-2 pb-6 sm:pt-6 sm:pb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-5xl text-fg">
            {activeTab === "dashboard" ? (
              "Confidential Portfolio."
            ) : (
              <>
                The blockchain is public.<br className="hidden sm:inline" /> Your money shouldn&apos;t be.
              </>
            )}
          </h1>
          <p className="mt-4 text-[14px] sm:text-[15px] leading-relaxed text-muted max-w-xl mx-auto">
            {activeTab === "dashboard"
              ? "Zero-knowledge shielded assets and real-time Starknet privacy pool status."
              : "Shield, swap, and transfer assets on Starknet with zero trace."}
          </p>
        </div>

        {/* Center: Navigation Tabs Pill */}
        <div className="mb-8 flex justify-center">
          <NavigationTabs
            activeTab={activeTab}
            onSelect={setActiveTab}
          />
        </div>

        {/* Center: Action Card Widget */}
        <div className="w-full">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18, ease: [0.25, 1, 0.5, 1] }}
            >
              {activeTab === "shield" && (
            showSetup && !demo ? (
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
                connected={isConnected}
                onConnect={() => setWalletModalOpen(true)}
              />
            )
          )}

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
              connected={isConnected}
              onConnect={() => setWalletModalOpen(true)}
            />
          )}

          {activeTab === "swap" && (
            <SwapTab
              spendable={shielded}
              token={token}
              feeStrk={sdkMode ? sdk.feeStrk : 0}
              connected={isConnected}
              onConnect={() => setWalletModalOpen(true)}
            />
          )}

          {activeTab === "unshield" && (
            <UnshieldTab
              shieldedBalance={shielded}
              token={token}
              feeStrk={sdkMode ? sdk.feeStrk : POOL_FEE_STRK}
              onUnshield={sdkMode ? sdk.unshield : real ? unshield : undefined}
              connected={isConnected}
              onConnect={() => setWalletModalOpen(true)}
            />
          )}

          {activeTab === "receive" && (
            <ReceiveTab
              address={displayAddress}
              receivable={
                sdkMode ? sdk.registered : strk20 === "supported" || demo === "on"
              }
              connected={isConnected}
              onConnect={() => setWalletModalOpen(true)}
            />
          )}

          {activeTab === "activity" && (
            <ActivityTab activity={activity} token={token} />
          )}

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
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Acctual-Style Trust Bullets */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.24 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-5 sm:gap-8 text-[13px] font-medium text-fg"
        >
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-fg" />
            <span>Zero calldata leakage</span>
            <span className="inline-flex items-center text-[11px] font-bold text-muted">
              ▼ 100%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-fg" />
            <span>Sponsored AVNU gas 0%</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-fg" />
            <span>STRK20 privacy pool</span>
          </div>
        </motion.div>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <div className="sticky bottom-0 z-40 w-full border-t border-border bg-bg/95 backdrop-blur-xl md:hidden">
        <div className="flex h-14 items-center justify-around px-2">
          {NAV_TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as NavTab)}
                className={`flex items-center justify-center rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  active ? "strk-pill-active font-semibold text-white shadow-sm" : "text-[#52525b] hover:text-fg"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

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
