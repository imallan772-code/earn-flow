import type { GameSessionRow } from "@/lib/gameSessions/schemas";
import { multFromE6 } from "@/lib/api/crashSession";
import { nonceFromRoundId } from "@/shared/games/gameSessionHelpers";
import type { ActiveCrashRound } from "@/shared/games/state/persistedGameState";

/** In-memory sentinel — server has not revealed bust point yet. */
export const CRASH_POINT_UNKNOWN = Number.POSITIVE_INFINITY;

/** JSON.stringify(Infinity) → null; 0 is our persist sentinel for server-side unknown. */
export function normalizeCrashPoint(value: unknown, serverSide?: boolean): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) return value;
  return serverSide ? CRASH_POINT_UNKNOWN : 1;
}

/** Avoid persisting Infinity (becomes null in localStorage). */
export function persistCrashPoint(value: number, serverSide?: boolean): number {
  if (serverSide && !Number.isFinite(value)) return 0;
  return value;
}

export function formatCrashMultiplier(value: unknown, serverSide?: boolean): string {
  const cp = normalizeCrashPoint(value, serverSide);
  if (!Number.isFinite(cp)) return "—";
  return `${cp.toFixed(2)}x`;
}

export function activeCrashRoundFromSession(
  row: GameSessionRow,
  fallback: { autoTarget: number; liveBetId?: string },
): ActiveCrashRound {
  const cs = row.client_state;
  const nonce = typeof cs.nonce === "number" ? cs.nonce : nonceFromRoundId(row.round_id);
  const stake =
    typeof cs.stake_amount === "number"
      ? cs.stake_amount
      : row.bet_amount > 0
        ? row.bet_amount
        : 0;
  const autoTargetE6 = typeof cs.auto_target_e6 === "number" ? cs.auto_target_e6 : null;
  const cashedAtE6 = typeof cs.cashed_at_e6 === "number" ? cs.cashed_at_e6 : null;
  const startedAtMs =
    typeof cs.started_at_ms === "number" && cs.started_at_ms > 0 ? cs.started_at_ms : 0;
  const betMode = cs.bet_mode === "demo" ? "demo" : "real";

  return {
    nonce,
    amount: stake,
    autoTarget: autoTargetE6 != null ? multFromE6(autoTargetE6) : fallback.autoTarget,
    cashedAt: cashedAtE6 != null ? multFromE6(cashedAtE6) : null,
    liveBetId: fallback.liveBetId ?? `lb_crash_${row.round_id}`,
    placedAt: typeof cs.placed_at === "number" ? cs.placed_at : Date.now(),
    crashPoint: CRASH_POINT_UNKNOWN,
    startedAt: startedAtMs,
    bettingStartedAt: typeof cs.betting_started_at === "number" ? cs.betting_started_at : 0,
    betMode,
    serverSide: true,
  };
}

function crashRpcMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  const e = error as { message?: string; details?: string; hint?: string };
  return `${e.message ?? ""} ${e.details ?? ""} ${e.hint ?? ""}`;
}

export function isKillSwitchActive(error: unknown): boolean {
  return crashRpcMessage(error).includes("KILL_SWITCH_ACTIVE");
}

function isMoneyInsufficient(error: unknown): boolean {
  const msg = crashRpcMessage(error);
  return msg.includes("MONEY_INSUFFICIENT") || msg.includes("insufficient");
}

export function crashPlaceErrorMessage(error: unknown): string {
  if (isKillSwitchActive(error)) {
    return "시스템 점검 중 — 신규 베팅이 일시 중단되었습니다";
  }
  if (isCrashSessionConflict(error)) {
    return "진행 중인 Crash 라운드가 있습니다";
  }
  if (isCrashSessionNotFound(error)) {
    return "세션이 만료되었습니다 — 다시 베팅해 주세요";
  }
  if (isMoneyInsufficient(error)) {
    return "PHON 잔액이 부족합니다";
  }
  return "베팅에 실패했습니다 (잔액 부족 또는 네트워크 오류)";
}

export function isCrashSessionConflict(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string; status?: number };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return (
    e.code === "42501" ||
    e.status === 409 ||
    msg.includes("CRASH_ACTIVE_SESSION") ||
    msg.includes("duplicate key")
  );
}

export function isCrashSessionNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return e.code === "P0002" || msg.includes("CRASH_SESSION_NOT_FOUND");
}

export function isCrashAlreadyBusted(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return msg.includes("CRASH_ALREADY_BUSTED");
}

export function isCrashPermanentCashoutError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { message?: string; details?: string };
  const msg = `${e.message ?? ""} ${e.details ?? ""}`;
  return (
    isCrashSessionNotFound(error) ||
    isCrashAlreadyBusted(error) ||
    msg.includes("CRASH_ALREADY_CASHED")
  );
}

/**
 * Server RPC round key — activeRound.nonce, never display nonce.
 * Requires open bet so spectators / stale store rows never hit start_running/sync poll.
 */
export function serverCrashRoundId(
  activeRound: { serverSide?: boolean; nonce: number } | null | undefined,
  hasOpenBet = true,
): string | null {
  if (!activeRound?.serverSide || !hasOpenBet) return null;
  return `n${activeRound.nonce}`;
}
