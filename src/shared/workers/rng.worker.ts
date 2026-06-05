/**
 * Off-main-thread HMAC digest for provably-fair game seeds.
 * Used by dice/crash engines when batch verification is needed.
 */
export interface RngWorkerRequest {
  id: string;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
}

export interface RngWorkerResponse {
  id: string;
  digestHex: string;
}

async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

self.onmessage = async (ev: MessageEvent<RngWorkerRequest>) => {
  const { id, serverSeed, clientSeed, nonce } = ev.data;
  const digestHex = await hmacSha256Hex(serverSeed, `${clientSeed}:${nonce}`);
  const response: RngWorkerResponse = { id, digestHex };
  self.postMessage(response);
};
