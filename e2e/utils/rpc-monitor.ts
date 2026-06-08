import type { Page, Response } from "@playwright/test";

export interface RpcFailure {
  url: string;
  status: number;
  body: string;
  at: string;
}

export interface RpcMonitor {
  failures: RpcFailure[];
  dispose: () => void;
}

/**
 * Captures failed Supabase RPC (PostgREST) responses during E2E.
 */
export function attachRpcMonitor(page: Page): RpcMonitor {
  const failures: RpcFailure[] = [];

  const handler = async (response: Response) => {
    const url = response.url();
    if (!url.includes("/rest/v1/rpc/")) return;
    const status = response.status();
    if (status < 400) return;
    let body = "";
    try {
      body = (await response.text()).slice(0, 500);
    } catch {
      body = "(unreadable body)";
    }
    failures.push({ url, status, body, at: new Date().toISOString() });
  };

  page.on("response", handler);

  return {
    failures,
    dispose: () => page.off("response", handler),
  };
}

function isBenignConsoleError(text: string): boolean {
  if (text.includes("favicon") || text.includes("DevTools")) return true;
  if (text.includes("Can't perform a React state update on a component that hasn't mounted yet")) {
    return true;
  }
  // Supabase Realtime reconnect noise during rapid game navigation — not a product bug.
  if (text.includes("WebSocket connection to") && text.includes("supabase.co/realtime")) {
    return true;
  }
  return false;
}

export function attachConsoleErrorMonitor(page: Page): { errors: string[]; dispose: () => void } {
  const errors: string[] = [];
  const handler = (msg: { type: () => string; text: () => string }) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (isBenignConsoleError(text)) return;
      errors.push(text.slice(0, 300));
    }
  };
  page.on("console", handler);
  return {
    errors,
    dispose: () => page.off("console", handler),
  };
}
