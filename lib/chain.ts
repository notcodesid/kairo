import { RpcProvider, constants } from "starknet";

/** Verified mainnet values — see DAY0-CHECK.md. */
export const RPC_URL = "https://rpc.starknet.lava.build";

/**
 * Keyless Sepolia RPC (verified working; Blast's public Sepolia endpoint is
 * decommissioned — do not use it).
 */
export const SEPOLIA_RPC_URL = "https://starknet-sepolia.drpc.org";

export const POOL_ADDRESS =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

/** Sepolia pool — for end-to-end testing before mainnet (docs/strk20-sdk-notes.md). */
export const SEPOLIA_POOL_ADDRESS =
  "0x0254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91";

export const MAINNET_CHAIN_ID = constants.StarknetChainId.SN_MAIN; // 0x534e5f4d41494e
export const SEPOLIA_CHAIN_ID = constants.StarknetChainId.SN_SEPOLIA;

export const provider = new RpcProvider({ nodeUrl: RPC_URL });

/**
 * Protocol fee per pool action on mainnet, in STRK (pool `get_fee_amount`,
 * confirmed in hackathon issue #156 — docs previously said 4).
 */
export const POOL_FEE_STRK = 6;

/**
 * Curated token list. The pool is token-agnostic — there is no on-chain
 * registry; the dapp supplies token addresses to every call and owns the
 * metadata. STRK's address is identical on mainnet and Sepolia.
 * More tokens (USDC, strkBTC, …) live in docs/strk20-sdk-notes.md.
 */
export interface PoolToken {
  address: string;
  symbol: string;
  decimals: number;
}

export const STRK: PoolToken = {
  address:
    "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
  symbol: "STRK",
  decimals: 18,
};

export const TOKENS: PoolToken[] = [STRK];

/**
 * Can this address receive a private transfer? True iff it has a registered
 * viewing key in the pool (`get_public_key` returns nonzero — verified on
 * mainnet: unregistered addresses return 0x0). Free RPC read, no wallet.
 * Returns undefined if the check itself fails — callers should fail open.
 */
export async function canReceivePrivately(
  address: string,
): Promise<boolean | undefined> {
  try {
    const res = await provider.callContract({
      contractAddress: POOL_ADDRESS,
      entrypoint: "get_public_key",
      calldata: [address],
    });
    return res.some((felt) => {
      try {
        return BigInt(felt) !== 0n;
      } catch {
        return false;
      }
    });
  } catch {
    return undefined; // check unavailable — don't block the send on it
  }
}
