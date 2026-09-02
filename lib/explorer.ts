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
  return network === "sepolia"
    ? "https://sepolia.voyager.online"
    : "https://voyager.online";
}
