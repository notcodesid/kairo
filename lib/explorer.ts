/** Voyager explorer link for a transaction hash. */
export function txUrl(hash: string, network: "mainnet" | "sepolia" = "mainnet"): string {
  return `${voyagerHost(network)}/tx/${hash}`;
}

/** Voyager page for a contract or account. */
export function addressUrl(
  address: string,
  network: "mainnet" | "sepolia" = "mainnet",
): string {
  return `${voyagerHost(network)}/contract/${address}`;
}

function voyagerHost(network: "mainnet" | "sepolia"): string {
  if (network === "sepolia") {
    return process.env.NEXT_PUBLIC_EXPLORER_SEPOLIA || "https://sepolia.voyager.online";
  }
  return process.env.NEXT_PUBLIC_EXPLORER_MAINNET || "https://voyager.online";
}
