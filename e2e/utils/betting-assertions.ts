import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import type { RpcFailure } from "./rpc-monitor";

const RECOVERABLE_RPC = [
  "PLINKO_ROUND_ALREADY_COMPLETED",
  "ACTIVE_GAME_SESSION",
] as const;

export function filterBlockingRpcFailures(
  failures: RpcFailure[],
  opts?: { allowMoneyErrors?: boolean },
): RpcFailure[] {
  return failures.filter((f) => {
    if (f.status < 400) return false;
    if (opts?.allowMoneyErrors && (f.body.includes("INSUFFICIENT") || f.body.includes("MONEY_"))) {
      return false;
    }
    if (f.status === 409 && RECOVERABLE_RPC.some((k) => f.body.includes(k))) return false;
    return true;
  });
}

export function assertNoBlockingRpcFailures(
  failures: RpcFailure[],
  opts?: { allowMoneyErrors?: boolean },
): void {
  const blocking = filterBlockingRpcFailures(failures, opts);
  expect(blocking, `RPC failures: ${JSON.stringify(blocking)}`).toHaveLength(0);
}

export function rpcFailuresIncludeInsufficient(failures: RpcFailure[]): boolean {
  return failures.some(
    (f) => f.body.includes("INSUFFICIENT") || f.body.includes("MONEY_INSUFFICIENT"),
  );
}
