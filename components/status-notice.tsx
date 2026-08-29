"use client";

import { Shield, Spinner } from "@/components/icons";
import type { Strk20Support } from "@/lib/wallet-store";

export function StatusNotice({
  isMainnet,
  strk20,
  walletName,
}: {
  isMainnet: boolean;
  strk20: Strk20Support;
  walletName?: string;
}) {
  let text: string;
  let tone: "info" | "setup" | "problem" = "problem";

  if (!isMainnet) {
    text = "Switch your wallet to Starknet Mainnet to use private balances.";
  } else if (strk20 === "unknown") {
    tone = "info";
    text = "Checking private-balance support…";
  } else if (strk20 === "unregistered") {
    // There is no dapp-side register call — the wallet registers the viewing
    // key on the user's first in-wallet shield.
    tone = "setup";
    text = `One-time setup: open ${walletName ?? "Ready"} and shield any amount — that turns on your private balance. Then come back here.`;
  } else {
    text = `${walletName ?? "This wallet"} doesn't support private balances yet. Install Ready to go private.`;
  }

  return (
    <p
      role="status"
      className="flex items-center gap-2.5 rounded-2xl bg-surface px-4 py-3 text-[13px] leading-5 text-muted ring-1 ring-border"
    >
      {tone === "info" ? (
        <Spinner size={14} className="shrink-0 text-faint" />
      ) : (
        <Shield
          size={14}
          className={`shrink-0 ${tone === "setup" ? "text-accent" : "text-danger"}`}
        />
      )}
      {text}
    </p>
  );
}
