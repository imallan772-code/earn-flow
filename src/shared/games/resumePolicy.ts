/**
 * Resume-First policy — Stake/Rollbit anti-abuse SSOT (GA-0).
 *
 * 절대 원칙: 이탈/새로고침/라우트 변경 시 refund 금지.
 * 복귀 시 세션 hydrate → 자동 정산만 허용.
 *
 * @see docs/PHONARA-GAME-AUTHORITY-PLAN-v3-FINAL.md §1.2, §5
 */

/** Global invariants — never override per game. */
export const RESUME_FIRST_POLICY = {
  refundOnUnmount: false,
  refundOnNavigation: false,
  refundOnRefresh: false,
  refundOnBeforeUnload: false,
} as const;

export type ResumeFirstPolicy = typeof RESUME_FIRST_POLICY;

/** PR review checklist (GA-0). */
export const GA0_PR_CHECKLIST = [
  "No refund() in useEffect cleanup / beforeunload / route unmount",
  "No refundPhonForBet on navigation for real mode",
  "fetchRealSession + hydrate + auto-settle on remount",
  "Server rejects refund when game_active_sessions.status = active",
] as const;

// ─── Crash (§5.1) ───────────────────────────────────────────────────────────

export type CrashResumeOutcome =
  | "loss_busted"
  | "win_auto_cashout"
  | "in_progress"
  | "betting_waiting";

/** C안(1.00x instant cashout on refresh) is explicitly rejected — abuse vector. */
export const CRASH_RESUME_REJECTED = ["instant_1x_cashout_on_refresh"] as const;

export const CRASH_ROUND_MAX_LIFETIME_MS = 60 * 60 * 1000;

// ─── Instant-settle games (§5.2) ───────────────────────────────────────────

export type InstantGameResumePolicy = {
  /** Outcome fixed at place; remount shows result only (idempotent). */
  onPlaceThenLeave: "fetch_round_status_display_only";
  onRollingLeave: "resume_animation_or_skip_to_result";
  afterSettled: "idle";
};

export const DICE_LIMBO_WHEEL_RESUME: InstantGameResumePolicy = {
  onPlaceThenLeave: "fetch_round_status_display_only",
  onRollingLeave: "resume_animation_or_skip_to_result",
  afterSettled: "idle",
};

// ─── Mines (§5.3) ───────────────────────────────────────────────────────────

export type MinesResumePolicy = {
  onLeave: "keep_game_active_sessions_and_secrets";
  onReturn: "restore_revealed_continue_play";
  afterMineHit: "display_settled_result_only";
};

export const MINES_RESUME: MinesResumePolicy = {
  onLeave: "keep_game_active_sessions_and_secrets",
  onReturn: "restore_revealed_continue_play",
  afterMineHit: "display_settled_result_only",
};

// ─── Plinko queue (§5.4) ────────────────────────────────────────────────────

export const PLINKO_STALE_PENDING_MS = 5 * 60 * 1000;

export type PlinkoQueueResumePolicy = {
  landedBalls: "already_credited_idempotent_history_only";
  pendingBall: "fetch_path_replay_animation_then_settle";
  stalePendingMs: number;
  staleAction: "server_auto_settle_not_refund";
  onUnmount: "no_refund";
};

export const PLINKO_QUEUE_RESUME: PlinkoQueueResumePolicy = {
  landedBalls: "already_credited_idempotent_history_only",
  pendingBall: "fetch_path_replay_animation_then_settle",
  stalePendingMs: PLINKO_STALE_PENDING_MS,
  staleAction: "server_auto_settle_not_refund",
  onUnmount: "no_refund",
};

// ─── Auto-bet stop (§5.5) ───────────────────────────────────────────────────

export type AutoBetStopPolicy = {
  stopNoInflight: "status_stopped_immediately";
  stopWithInflight: "status_stopping_complete_round_then_stopped";
  leaveWhileActive: "server_worker_continues_ui_stop_on_return";
  whileStopping: "worker_no_new_rounds";
};

export const AUTO_BET_STOP: AutoBetStopPolicy = {
  stopNoInflight: "status_stopped_immediately",
  stopWithInflight: "status_stopping_complete_round_then_stopped",
  leaveWhileActive: "server_worker_continues_ui_stop_on_return",
  whileStopping: "worker_no_new_rounds",
};

/** Assert policy at dev time — tree-shaken in prod if unused. */
export function assertResumeFirstPolicy(): void {
  if (RESUME_FIRST_POLICY.refundOnUnmount) {
    throw new Error("RESUME_FIRST_POLICY violation: refundOnUnmount must be false");
  }
}
