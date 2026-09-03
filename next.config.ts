import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Bypass the SDK's /testing barrel: it re-exports dev tooling that
    // pulls starknet-devnet + node builtins (child_process, fs, net) into
    // the browser bundle. We only need the leaf discovery module, which is
    // pure RPC + crypto. The alias maps to the file directly, so the
    // package "exports" map (which hides internal/ paths) is not consulted.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@sdk-internal": `${process.cwd()}/node_modules/@starkware-libs/starknet-privacy-sdk/dist/internal`,
    };
    return config;
  },
};

export default nextConfig;
