-- Day B: crash_sync_v1 latency mitigation — round_id in partial index.
-- Forward-only, idempotent. Targets JOIN filter:
--   WHERE user_id = v_uid AND game = 'crash' AND round_id = v_round AND status = 'active'

CREATE INDEX IF NOT EXISTS idx_game_active_sessions_user_game_round
  ON public.game_active_sessions (user_id, game, round_id)
  WHERE status = 'active';
