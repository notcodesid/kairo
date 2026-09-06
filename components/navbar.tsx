"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import {
  KairoMark,
  ChevronDown,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from "@/components/icons";
import { truncateAddress } from "@/lib/format";
import { txUrl } from "@/lib/explorer";

export type NavTab = "dashboard" | "shield" | "transfer" | "swap" | "unshield" | "receive" | "activity";

interface NavbarProps {
  activeTab?: NavTab;
  onSelectTab?: (tab: NavTab) => void;
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
  connectLabel = "Connect wallet",
  disconnectLabel = "Disconnect Wallet",
}: NavbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kairo-theme");
    const isDark =
      saved === "dark" ||
      (!saved && typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (isDark) {
      document.documentElement.classList.add("dark");
      setTheme("dark");
    } else {
      document.documentElement.classList.remove("dark");
      setTheme("light");
    }
  }, []);

  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (next === "dark") {
      document.documentElement.classList.add("dark");
      localStorage.setItem("kairo-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("kairo-theme", "light");
    }
  }

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
    <header className="sticky top-0 z-40 w-full bg-transparent transition-all">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Brand & Network Status */}
        <div className="flex items-center gap-3 sm:gap-4">
          <motion.button
            type="button"
            onClick={() => onSelectTab?.("dashboard")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="group flex items-center gap-2 text-left focus-visible:outline-none cursor-pointer"
          >
            <KairoMark size={22} className="text-fg shrink-0" />
            <span className="font-brand text-[21px] font-bold text-fg">kairo</span>
          </motion.button>
          {demo && (
            <span className="hidden rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-medium text-fg ring-1 ring-border-strong lg:inline-flex items-center">
              Demo Mode
            </span>
          )}
        </div>

        {/* Right: Theme Toggle, Route switch & Wallet Connection */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Theme Toggle Button */}
          <motion.button
            type="button"
            onClick={toggleTheme}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            transition={{ type: "spring", stiffness: 450, damping: 25 }}
            className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-fg hover:bg-surface ring-1 ring-border transition-colors cursor-pointer"
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2" />
                <path d="M12 20v2" />
                <path d="m4.93 4.93 1.41 1.41" />
                <path d="m17.66 17.66 1.41 1.41" />
                <path d="M2 12h2" />
                <path d="M20 12h2" />
                <path d="m6.34 17.66-1.41 1.41" />
                <path d="m19.07 4.93-1.41 1.41" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
              </svg>
            )}
          </motion.button>
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
                  className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-all focus-visible:outline-none ${
                    mode === m.id
                      ? "strk-pill-active font-semibold text-white shadow-sm"
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
              <motion.button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                className="flex items-center gap-2.5 rounded-full bg-surface px-3.5 py-1.5 ring-1 ring-border transition-colors hover:bg-surface-2 hover:ring-border-strong focus-visible:outline-none cursor-pointer"
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
                  <span className="size-2 rounded-full bg-fg" />
                )}

                <div className="flex flex-col text-left">
                  <span className="font-mono text-[13px] font-medium text-fg">
                    {truncateAddress(address)}
                  </span>
                </div>

                <ChevronDown size={14} className="text-muted" />
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl bg-surface p-2 shadow-xl ring-1 ring-border backdrop-blur-xl z-50"
                  >
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
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <motion.button
              type="button"
              onClick={onConnectClick}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ type: "spring", stiffness: 450, damping: 25 }}
              className="btn-strk20 flex h-10 items-center justify-center rounded-full px-5 text-[14px] font-semibold text-white focus-visible:outline-none cursor-pointer"
            >
              <span>{connectLabel}</span>
            </motion.button>
          )}
        </div>
      </div>
    </header>
  );
}
