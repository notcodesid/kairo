/** Format a token amount: grouped thousands, up to `maxFrac` decimals, trailing zeros trimmed. */
export function formatAmount(value: number, maxFrac = 4): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
}

/** Split into integer + fractional parts so the UI can de-emphasize decimals. */
export function splitAmount(
  value: number,
  maxFrac = 4,
): { int: string; frac: string } {
  const s = formatAmount(value, maxFrac);
  const [int, frac = ""] = s.split(".");
  return { int, frac };
}

/**
 * Convert an on-chain integer amount (felt/u256 as hex string or bigint) to a
 * display number, keeping 6 fractional digits of precision.
 */
export function feltToAmount(felt: string | bigint, decimals: number): number {
  let raw: bigint;
  try {
    raw = typeof felt === "bigint" ? felt : BigInt(felt);
  } catch {
    return 0;
  }
  const keep = Math.min(decimals, 6);
  const shift = 10n ** BigInt(Math.max(0, decimals - keep));
  return Number(raw / shift) / 10 ** keep;
}

/**
 * Convert a human amount ("25.5") to on-chain integer units. String math —
 * float multiplication would drift on 18-decimal tokens.
 */
export function amountToUnits(value: string | number, decimals: number): bigint {
  const s = String(value).trim();
  if (!/^\d*\.?\d*$/.test(s) || s === "" || s === ".") return 0n;
  const [int = "0", frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(int || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

/** 0x00cD…B7e style truncation for an address. */
export function truncateAddress(addr: string, lead = 6, tail = 4): string {
  if (!addr) return "";
  if (addr.length <= lead + tail) return addr;
  return `${addr.slice(0, lead)}…${addr.slice(-tail)}`;
}
