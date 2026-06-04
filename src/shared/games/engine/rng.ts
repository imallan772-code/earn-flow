/**
 * RNG primitives — pure, deterministic, no side effects.
 * Used as the seed layer for all PHONARA games.
 */

/**
 * Mulberry32 — 32-bit deterministic PRNG.
 * Returns a function that yields uniform [0, 1) floats.
 * Same seed → identical sequence forever (Stake.com-grade determinism).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Xorshift32 — secondary PRNG used to cross-check determinism in tests.
 * Returns a function that yields uniform [0, 1) floats.
 */
export function xorshift32(seed: number): () => number {
  let x = (seed | 0) || 1;
  return function next(): number {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 4294967296) / 4294967296;
  };
}

/**
 * FNV-1a 32-bit string hash. Stable across runs/environments.
 * Use to derive a numeric seed from arbitrary strings (server seed, room id, etc).
 */
export function hashStringToSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * SHA-256 hex digest via Web Crypto. Async.
 * Used by provably-fair flows (commit/reveal of server seed).
 */
export async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}
