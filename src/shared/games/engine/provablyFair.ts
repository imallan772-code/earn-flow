/**
 * Provably-fair primitives — Stake.com 1:1 scheme.
 *
 * Flow:
 *   1. Server generates `serverSeed`. Publishes `sha256(serverSeed)` upfront.
 *   2. Client supplies `clientSeed` (editable by user) + `nonce` (per round).
 *   3. Bytes are drawn from HMAC-SHA256(serverSeed, `${clientSeed}:${nonce}:${cursor}`).
 *   4. After the round closes, server reveals `serverSeed`. Anyone can verify
 *      the published hash and re-derive the round's outcome bytes.
 */

import { sha256Hex } from "./rng";

export interface ProvablyFairInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

/** Sha256 hash of the server seed — publish BEFORE the round starts. */
export async function commitServerSeed(serverSeed: string): Promise<string> {
  return sha256Hex(serverSeed);
}

/** Verify a revealed seed matches a previously published commit hash. */
export async function verifyRevealedSeed(serverSeed: string, commitHash: string): Promise<boolean> {
  const h = await sha256Hex(serverSeed);
  return h === commitHash;
}

async function hmacSha256(keyStr: string, msgStr: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msgStr));
  return new Uint8Array(sig);
}

/**
 * Stream HMAC-SHA256 bytes for a (serverSeed, clientSeed, nonce, cursor) tuple.
 * Each `cursor` yields 32 fresh bytes. Increment cursor for more entropy.
 */
export async function bytesGenerator(
  { serverSeed, clientSeed, nonce }: ProvablyFairInput,
  cursor: number
): Promise<Uint8Array> {
  return hmacSha256(serverSeed, `${clientSeed}:${nonce}:${cursor}`);
}

/**
 * Convert 4 bytes → uniform [0, 1) float.
 * Stake's published method: sum of byte/(256^k) for k=1..4.
 */
export function floatFromBytes(bytes: Uint8Array, offset = 0): number {
  if (bytes.length < offset + 4) {
    throw new Error("floatFromBytes: need at least 4 bytes from offset");
  }
  let f = 0;
  for (let i = 0; i < 4; i++) {
    f += bytes[offset + i] / Math.pow(256, i + 1);
  }
  return f;
}

/**
 * Draw `count` independent [0,1) floats for one round, starting from cursor 0.
 * Each draw consumes 4 bytes; we refresh the byte stream every 8 draws (32B).
 */
export async function drawFloats(input: ProvablyFairInput, count: number): Promise<number[]> {
  const out: number[] = [];
  let cursor = 0;
  let bytes = await bytesGenerator(input, cursor);
  let offset = 0;
  for (let i = 0; i < count; i++) {
    if (offset + 4 > bytes.length) {
      cursor += 1;
      bytes = await bytesGenerator(input, cursor);
      offset = 0;
    }
    out.push(floatFromBytes(bytes, offset));
    offset += 4;
  }
  return out;
}
