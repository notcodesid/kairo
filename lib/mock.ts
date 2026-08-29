// Mock wallet data for building the UI. The wiring layer replaces this with
// real data from `wa.strk20Balances()` + note discovery (see docs/umbra-research.md).

export type ActivityKind = "received" | "sent" | "shield" | "unshield";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  amount: number;
  token: string;
  /** Truncated peer address, or "private" when the counterparty is shielded. */
  peer?: string;
  /** Human relative time (mock). */
  at: string;
}

export interface WalletSnapshot {
  address: string;
  /** Spendable shielded balance (notes ≥ 10 blocks old). */
  shielded: number;
  /**
   * Freshly received/shielded value still maturing. STRK20 notes become
   * spendable 10 blocks (~5 min) after creation — surface this or a fresh
   * balance looks broken when a send fails.
   */
  pending: number;
  /** Public (unshielded) STRK balance — source for the Shield flow. */
  publicStrk: number;
  token: string;
  activity: ActivityItem[];
}

export const MOCK_WALLET: WalletSnapshot = {
  address:
    "0x00cDfA296c7F37FE5515bf00F493C6e74fEe20cB9074A3d3ba0058a88e623B7e",
  shielded: 128.402,
  pending: 40,
  publicStrk: 245.1,
  token: "STRK",
  activity: [
    { id: "1", kind: "received", amount: 40, token: "STRK", peer: "private", at: "Just now" },
    { id: "2", kind: "shield", amount: 100, token: "STRK", at: "Yesterday" },
    { id: "3", kind: "sent", amount: 11.6, token: "STRK", peer: "0x04a1…9c2f", at: "3d ago" },
  ],
};
