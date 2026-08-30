import { ec, hash } from "starknet";

/**
 * Upper bound for a canonical viewing key: half the STARK curve order.
 * (Keys live in [1, n/2] — an upper-half value is folded down, preserving
 * the public-key x-coordinate.)
 */
export const MAX_VIEWING_KEY = ec.starkCurve.CURVE.n / 2n;

/**
 * Canonical STRK20 viewing-key derivation — an exact port of StarkWare's
 * reference implementation (starknet-privacy `demo/src/session.ts`):
 *
 *   sign starknetKeccak(`${chainId}:${poolAddress}`) with the account's RAW
 *   private key → poseidon-fold (r, s) → reduce mod curve order → fold into
 *   [1, n/2].
 *
 * ⚠️ This requires the account's raw private key, which wallets like Ready
 * never expose — so this derivation is ONLY valid for accounts whose keys
 * the app itself holds (self-custody / throwaway accounts). Registering a
 * key derived any other way for a wallet-held account would permanently
 * mismatch the wallet's own derivation (registration is immutable).
 */
export function deriveViewingKey(
  privateKey: string,
  chainId: string,
  poolAddress: string,
): bigint {
  const messageHash = hash.starknetKeccak(`${chainId}:${poolAddress}`);
  const signature = ec.starkCurve.sign(
    `0x${messageHash.toString(16)}`,
    privateKey,
  );
  const folded = BigInt(
    hash.computePoseidonHashOnElements([signature.r, signature.s]),
  );
  const order = ec.starkCurve.CURVE.n;
  const reduced = folded % order;
  const canonical = reduced < MAX_VIEWING_KEY ? reduced : order - reduced;
  return canonical === 0n ? 1n : canonical;
}
