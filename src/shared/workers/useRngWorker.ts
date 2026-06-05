import { useCallback, useEffect, useRef } from "react";
import type { RngWorkerRequest, RngWorkerResponse } from "./rng.worker";

let workerSingleton: Worker | null = null;

function getRngWorker(): Worker | null {
  if (typeof window === "undefined") return null;
  if (!workerSingleton) {
    workerSingleton = new Worker(new URL("./rng.worker.ts", import.meta.url), { type: "module" });
  }
  return workerSingleton;
}

/** Request HMAC digest off the main thread (Web Worker). */
export function useRngWorker() {
  const pending = useRef(
    new Map<string, { resolve: (hex: string) => void; reject: (e: Error) => void }>(),
  );

  useEffect(() => {
    const worker = getRngWorker();
    if (!worker) return;

    const onMessage = (ev: MessageEvent<RngWorkerResponse>) => {
      const entry = pending.current.get(ev.data.id);
      if (!entry) return;
      pending.current.delete(ev.data.id);
      entry.resolve(ev.data.digestHex);
    };

    worker.addEventListener("message", onMessage);
    return () => worker.removeEventListener("message", onMessage);
  }, []);

  const digestHex = useCallback((serverSeed: string, clientSeed: string, nonce: number) => {
    const worker = getRngWorker();
    if (!worker) {
      return Promise.reject(new Error("RNG worker unavailable"));
    }
    const id = crypto.randomUUID();
    const req: RngWorkerRequest = { id, serverSeed, clientSeed, nonce };
    return new Promise<string>((resolve, reject) => {
      pending.current.set(id, { resolve, reject });
      worker.postMessage(req);
    });
  }, []);

  return { digestHex };
}
