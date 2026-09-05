"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import {
  KairoMark,
  Shield,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  ShieldPlus,
  ArrowLeftRight,
  Activity as ActivityIcon,
  Sparkles,
} from "@/components/icons";
import { truncateAddress } from "@/lib/format";
import { txUrl } from "@/lib/explorer";

export type NavTab = "dashboard" | "shield" | "transfer" | "unshield" | "receive" | "activity";

interface NavbarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  connected: boolean;
  address?: string;
  walletName?: string;
  walletIcon?: string;
  isMainnet?: boolean;
  isRegistered?: boolean;
  shieldedBalance?: number;
  token?: string;
  onConnectClick: () => void;
  onDisconnect: () => void;
  onRefresh?: () => Promise<unknown>;
  demo?: string;
  /** Key-holding route switch. Rendered only when onModeChange is provided. */
  mode?: "wallet" | "sdk";
  onModeChange?: (mode: "wallet" | "sdk") => void;
  connectLabel?: string;
  disconnectLabel?: string;
}

export function Navbar({
  activeTab,
  onSelectTab,
  connected,
  address,
  walletIcon,
  isMainnet = true,
  shieldedBalance = 0,
  token = "STRK",
  onConnectClick,
  onDisconnect,
  onRefresh,
  demo,
  mode = "wallet",
  onModeChange,
  connectLabel = "Connect Wallet",
  disconnectLabel = "Disconnect Wallet",
}: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard?.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function handleRefresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setRefreshing(false), 600);
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-bg/90 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand & Network Status */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={() => onSelectTab("dashboard")}
            className="group flex items-center gap-2.5 text-left focus-visible:outline-none"
          >
            <span className="flex size-9 items-center justify-center rounded-xl bg-surface-2 text-fg ring-1 ring-border transition-all duration-150 group-hover:bg-black group-hover:text-white group-hover:ring-black">
              <KairoMark size={20} />
            </span>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="text-[16px] font-bold tracking-tight text-fg">Kairo</span>
                <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-fg ring-1 ring-border">
                  v2
                </span>
              </div>
              <span className="hidden text-[11px] font-medium text-muted sm:inline">
                Umbra-style Starknet Privacy
              </span>
            </div>
          </button>

          {/* Network Pill */}
          <div className="hidden items-center gap-2 rounded-full bg-surface px-3 py-1 text-[12px] font-medium text-fg ring-1 ring-border md:flex">
            <span
              className={`size-2 rounded-full ${
                isMainnet ? "bg-black ring-2 ring-black/20" : "bg-muted ring-1 ring-border"
              }`}
            />
            <span>{isMainnet ? "Starknet Mainnet" : "Sepolia Testnet"}</span>
          </div>

          {demo && (
            <span className="hidden rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-fg ring-1 ring-border-strong lg:inline-flex items-center gap-1">
              <Sparkles size={11} /> Demo Mode
            </span>
          )}
        </div>

        {/* Center: Desktop Navigation Tabs */}
        <nav className="hidden items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-border md:flex">
          {[
            { id: "dashboard", label: "Overview", icon: Shield },
            { id: "shield", label: "Shield", icon: ShieldPlus },
            { id: "transfer", label: "Transfer", icon: ArrowUpRight },
            { id: "unshield", label: "Unshield", icon: ArrowLeftRight },
            { id: "receive", label: "Receive", icon: ArrowDownLeft },
            { id: "activity", label: "Activity", icon: ActivityIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id as NavTab)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${
                  active
                    ? "bg-black text-white shadow-sm ring-1 ring-black font-semibold"
                    : "text-muted hover:bg-surface hover:text-fg"
                }`}
              >
                <Icon size={14} className={active ? "text-white" : "text-muted"} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Right: Route switch & Wallet Connection */}
        <div className="flex items-center gap-2.5">
          {onModeChange && (
            <div
              className="hidden items-center gap-1 rounded-full bg-surface-2 p-1 ring-1 ring-border sm:flex"
              role="tablist"
              aria-label="Key-holding route"
            >
              {(
                [
                  { id: "wallet", label: "Wallet" },
                  { id: "sdk", label: "SDK key" },
                ] as const
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="tab"
                  aria-selected={mode === m.id}
                  onClick={() => onModeChange(m.id)}
                  title={
                    m.id === "wallet"
                      ? "Ready wallet holds the viewing key"
                      : "Kairo holds the key itself (Sepolia)"
                  }
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black ${
                    mode === m.id
                      ? "bg-black font-semibold text-white ring-1 ring-black shadow-sm"
                      : "text-muted hover:text-fg"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          )}
          {connected && address ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex items-center gap-2.5 rounded-full bg-surface px-3 py-1.5 ring-1 ring-border transition-all duration-150 hover:bg-surface-2 hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
              >
                {walletIcon ? (
                  <Image
                    src={walletIcon}
                    alt=""
                    width={20}
                    height={20}
                    className="size-5 rounded-full"
                    unoptimized
                  />
                ) : (
                  <span className="flex size-5 items-center justify-center rounded-full bg-surface-2 text-fg ring-1 ring-border">
                    <Shield size={12} />
                  </span>
                )}

                <div className="flex flex-col text-left">
                  <span className="font-mono text-[13px] font-medium text-fg">
                    {truncateAddress(address)}
                  </span>
                </div>

                <ChevronDown size={14} className="text-muted" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-surface p-2 shadow-xl ring-1 ring-border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100 z-50">
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="text-[11px] font-medium text-faint uppercase tracking-wider">
                      Connected Account
                    </p>
                    <p className="mt-0.5 font-mono text-[13px] text-fg break-all select-all">
                      {truncateAddress(address, 10, 8)}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[12px]">
                      <span className="text-muted">Shielded:</span>
                      <span className="font-mono font-semibold text-fg">
                        {shieldedBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                        {token}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-0.5 py-1.5">
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <span className="flex items-center gap-2">
                        {copied ? <Check size={14} className="text-fg font-bold" /> : <Copy size={14} />}
                        {copied ? "Copied address" : "Copy address"}
                      </span>
                    </button>

                    <a
                      href={txUrl(address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                    >
                      <span className="flex items-center gap-2">
                        <ExternalLink size={14} /> View on Voyager
                      </span>
                    </a>

                    {onRefresh && (
                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50"
                      >
                        <span className="flex items-center gap-2">
                          <RefreshCw
                            size={14}
                            className={refreshing ? "animate-spin text-fg" : ""}
                          />
                          Sync balances
                        </span>
                      </button>
                    )}
                  </div>

                  <div className="border-t border-border pt-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDropdownOpen(false);
                        onDisconnect();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-medium text-fg transition-colors hover:bg-surface-2"
                    >
                      {disconnectLabel}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onConnectClick}
              className="flex items-center gap-2 rounded-full bg-black px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"
            >
              <Wallet size={15} />
              <span>{connectLabel}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
