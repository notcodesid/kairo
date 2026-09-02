"use client";

import Image from "next/image";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { X, Shield, Spinner, ExternalLink, Sparkles } from "@/components/icons";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
  wallets: WalletWithStarknetFeatures[];
  connecting: boolean;
  onConnect: (wallet: WalletWithStarknetFeatures) => void;
  error?: string;
  onSelectDemo?: () => void;
}

const READY_DOWNLOAD_URL = "https://www.ready.co/download";

export function WalletModal({
  open,
  onClose,
  wallets,
  connecting,
  onConnect,
  error,
  onSelectDemo,
}: WalletModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-bg/80 backdrop-blur-md transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-surface p-6 shadow-2xl ring-1 ring-border animate-in zoom-in-95 fade-in duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-xl bg-surface-2 text-accent ring-1 ring-border">
              <Shield size={16} />
            </span>
            <div>
              <h3 className="text-[16px] font-semibold text-fg">Connect Starknet Wallet</h3>
              <p className="text-[12px] text-faint">Select a wallet to access STRK20 privacy</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X size={16} />
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-danger/10 p-3 ring-1 ring-danger/25">
            <p className="text-[13px] text-danger">{error}</p>
          </div>
        )}

        <div className="mt-5 space-y-2.5">
          {wallets.length > 0 ? (
            wallets.map((w) => (
              <button
                key={w.name}
                type="button"
                onClick={() => onConnect(w)}
                disabled={connecting}
                className="group flex h-14 w-full items-center justify-between rounded-2xl bg-surface-2/60 px-4 ring-1 ring-border transition-all duration-150 hover:bg-surface-2 hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
              >
                <div className="flex items-center gap-3">
                  {w.icon ? (
                    <Image
                      src={w.icon}
                      alt={w.name}
                      width={28}
                      height={28}
                      className="size-7 rounded-xl"
                      unoptimized
                    />
                  ) : (
                    <span className="flex size-7 items-center justify-center rounded-xl bg-surface text-faint ring-1 ring-border">
                      <Shield size={14} />
                    </span>
                  )}
                  <div className="flex flex-col text-left">
                    <span className="text-[14px] font-medium text-fg">{w.name}</span>
                    <span className="text-[11px] text-faint">
                      {w.name.toLowerCase().includes("ready")
                        ? "Recommended for STRK20"
                        : "Standard Starknet wallet"}
                    </span>
                  </div>
                </div>

                {connecting ? (
                  <Spinner size={16} className="text-accent" />
                ) : (
                  <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium text-muted ring-1 ring-border group-hover:text-fg">
                    Connect
                  </span>
                )}
              </button>
            ))
          ) : (
            <div className="rounded-2xl bg-surface-2/40 p-5 text-center ring-1 ring-border">
              <p className="text-[14px] font-medium text-fg">No Starknet wallet detected</p>
              <p className="mt-1 text-[12px] leading-5 text-faint">
                Install <strong>Ready</strong> (the official wallet for STRK20 private balances) to get started.
              </p>
              <div className="mt-4 flex flex-col gap-2">
                <a
                  href={READY_DOWNLOAD_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-accent text-[13px] font-semibold text-bg transition-colors hover:bg-accent-strong"
                >
                  <ExternalLink size={14} /> Install Ready Wallet
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Demo Switch Option */}
        {onSelectDemo && (
          <div className="mt-5 border-t border-border/80 pt-4">
            <button
              type="button"
              onClick={() => {
                onSelectDemo();
                onClose();
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2/50 py-2.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-accent ring-1 ring-border"
            >
              <Sparkles size={13} className="text-accent" /> Explore in Interactive Demo Mode
            </button>
          </div>
        )}

        <div className="mt-4 text-center">
          <p className="text-[11px] text-faint">
            Private by default · Secured by Cairo STARK proofs
          </p>
        </div>
      </div>
    </div>
  );
}
