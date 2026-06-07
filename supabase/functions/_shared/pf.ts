/**
 * Stake HMAC-SHA256 provably-fair — Deno Edge shared module.
 * Byte-identical with src/shared/games/engine/provablyFair.ts (GA-A contract).
 */

export interface ProvablyFairInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

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

export async function commitServerSeed(serverSeed: string): Promise<string> {
  return sha256Hex(serverSeed);
}

async function hmacSha256(keyStr: string, msgStr: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(keyStr),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msgStr));
  return new Uint8Array(sig);
}

export async function bytesGenerator(
  { serverSeed, clientSeed, nonce }: ProvablyFairInput,
  cursor: number,
): Promise<Uint8Array> {
  return hmacSha256(serverSeed, `${clientSeed}:${nonce}:${cursor}`);
}

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
