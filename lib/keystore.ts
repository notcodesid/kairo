/**
 * Encrypted key custody for the SDK route.
 *
 * The embedded private key is encrypted with AES-GCM-256, the key derived
 * via PBKDF2-SHA256 (600k iterations) from a user password. Only
 * { salt, iv, data } ever touches localStorage — the plaintext key lives
 * solely in memory while unlocked and is wiped on lock/forget.
 *
 * WebCrypto only (no Buffer, no node polyfills) so this runs in the browser.
 */

const ITERATIONS = 600_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export interface EncryptedKey {
  v: 1;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 (AES-GCM ciphertext of the 0x hex key)
}

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPrivateKey(
  privateKeyHex: string,
  password: string,
): Promise<EncryptedKey> {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    enc.encode(privateKeyHex),
  );
  return { v: 1, salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(ct)) };
}

export async function decryptPrivateKey(
  payload: EncryptedKey,
  password: string,
): Promise<string> {
  let key: CryptoKey;
  try {
    key = await deriveKey(password, fromB64(payload.salt));
  } catch {
    throw new Error("Wrong password — could not unlock this key.");
  }
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(payload.iv) as BufferSource },
      key,
      fromB64(payload.data) as BufferSource,
    );
    const hex = dec.decode(pt);
    if (!/^0x[0-9a-fA-F]{63,64}$/.test(hex)) {
      throw new Error("Wrong password — could not unlock this key.");
    }
    return hex;
  } catch (e) {
    if (String((e as Error)?.message ?? e).startsWith("Wrong password")) throw e;
    throw new Error("Wrong password — could not unlock this key.");
  }
}
