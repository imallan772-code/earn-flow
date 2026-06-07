-- GA-J: Server-authoritative auto-bet (J-1) — sessions table + worker tick + client RPCs.
-- Instant games v1: dice, limbo, wheel. Client loop fallback when auto_bet_server flag off.
-- Does NOT touch live_bets triggers or autobot paths.

-- ─── auto_bet_sessions ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.auto_bet_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game text NOT NULL CHECK (game IN ('dice', 'limbo', 'wheel', 'crash', 'plinko', 'mines')),
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'paused', 'stopping', 'stopped', 'completed', 'error')),
  config jsonb NOT NULL,
  bet_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_bet bigint NOT NULL CHECK (current_bet >= 1),
  bets_placed int NOT NULL DEFAULT 0 CHECK (bets_placed >= 0),
  pnl bigint NOT NULL DEFAULT 0,
  fib_index int NOT NULL DEFAULT 0 CHECK (fib_index >= 0),
  stop_reason text CHECK (stop_reason IS NULL OR stop_reason IN ('count', 'profit', 'loss', 'manual', 'limit', 'error')),
  waiting_round_id text,
  last_tick_at timestamptz,
  next_tick_at timestamptz NOT NULL DEFAULT now(),
  daily_rounds_today int NOT NULL DEFAULT 0,
  daily_rounds_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  consecutive_losses int NOT NULL DEFAULT 0,
  starting_bankroll_phon bigint,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  stopped_at timestamptz
);

CREATE INDEX IF NOT EXISTS auto_bet_sessions_worker_idx
  ON public.auto_bet_sessions (status, next_tick_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS auto_bet_sessions_user_active_idx
  ON public.auto_bet_sessions (user_id, status)
  WHERE status IN ('running', 'paused', 'stopping');

ALTER TABLE public.auto_bet_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auto_bet_sessions_select_own ON public.auto_bet_sessions;
CREATE POLICY auto_bet_sessions_select_own ON public.auto_bet_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.auto_bet_sessions FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.auto_bet_sessions TO authenticated;

-- Realtime (J-3 UI)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.auto_bet_sessions;
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ─── Helpers ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_bet_fib_at(p_index int)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_i int := greatest(0, p_index);
  v_a bigint := 1;
  v_b bigint := 1;
  v_c bigint;
  v_k int;
BEGIN
  FOR v_k IN 0..v_i - 1 LOOP
    v_c := v_a + v_b;
    v_a := v_b;
    v_b := v_c;
  END LOOP;
  RETURN v_a;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_bet_fib_at(int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_bet_internal_set_uid(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
END;
$$;

REVOKE ALL ON FUNCTION public.auto_bet_internal_set_uid(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Mirrors src/shared/games/engine/autoBet.ts step() — SSOT for server worker.
CREATE OR REPLACE FUNCTION public.auto_bet_apply_outcome_v1(
  p_config jsonb,
  p_current_bet bigint,
  p_fib_index int,
  p_bets_placed int,
  p_pnl bigint,
  p_outcome text,
  p_delta bigint
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_strategy text := coalesce(p_config->>'strategy', 'Flat');
  v_base_bet bigint := greatest(1, coalesce((p_config->>'baseBet')::bigint, (p_config->>'base_bet')::bigint, 1));
  v_number_of_bets int := coalesce((p_config->>'numberOfBets')::int, (p_config->>'number_of_bets')::int, 0);
  v_on_win_pct numeric := coalesce((p_config->>'onWinIncreasePct')::numeric, (p_config->>'on_win_increase_pct')::numeric, 0);
  v_on_loss_pct numeric := coalesce((p_config->>'onLossIncreasePct')::numeric, (p_config->>'on_loss_increase_pct')::numeric, 0);
  v_stop_profit bigint := coalesce((p_config->>'stopOnProfit')::bigint, (p_config->>'stop_on_profit')::bigint, 0);
  v_stop_loss bigint := coalesce((p_config->>'stopOnLoss')::bigint, (p_config->>'stop_on_loss')::bigint, 0);
  v_bets_placed int := p_bets_placed + 1;
  v_pnl bigint := p_pnl + p_delta;
  v_next_bet bigint := p_current_bet;
  v_fib_index int := p_fib_index;
  v_pct numeric;
  v_running boolean := true;
  v_stop_reason text := NULL;
BEGIN
  IF lower(trim(p_outcome)) = 'win' THEN
    v_pct := v_on_win_pct;
  ELSE
    v_pct := v_on_loss_pct;
  END IF;

  IF v_pct <> 0 THEN
    v_next_bet := greatest(1, round(p_current_bet::numeric * (1 + v_pct / 100.0))::bigint);
  ELSE
    CASE v_strategy
      WHEN 'Flat' THEN v_next_bet := v_base_bet;
      WHEN 'Martingale' THEN
        v_next_bet := CASE WHEN lower(trim(p_outcome)) = 'loss' THEN p_current_bet * 2 ELSE v_base_bet END;
      WHEN 'AntiMartingale' THEN
        v_next_bet := CASE WHEN lower(trim(p_outcome)) = 'win' THEN p_current_bet * 2 ELSE v_base_bet END;
      WHEN 'Fibonacci' THEN
        v_fib_index := CASE
          WHEN lower(trim(p_outcome)) = 'loss' THEN p_fib_index + 1
          ELSE greatest(0, p_fib_index - 2)
        END;
        v_next_bet := v_base_bet * public.auto_bet_fib_at(v_fib_index);
      WHEN 'DAlembert' THEN
        v_next_bet := CASE
          WHEN lower(trim(p_outcome)) = 'loss' THEN p_current_bet + v_base_bet
          ELSE greatest(v_base_bet, p_current_bet - v_base_bet)
        END;
      ELSE v_next_bet := v_base_bet;
    END CASE;
  END IF;

  IF v_number_of_bets > 0 AND v_bets_placed >= v_number_of_bets THEN
    v_running := false;
    v_stop_reason := 'count';
  ELSIF v_stop_profit > 0 AND v_pnl >= v_stop_profit THEN
    v_running := false;
    v_stop_reason := 'profit';
  ELSIF v_stop_loss > 0 AND v_pnl <= -v_stop_loss THEN
    v_running := false;
    v_stop_reason := 'loss';
  END IF;

  RETURN jsonb_build_object(
    'current_bet', v_next_bet,
    'bets_placed', v_bets_placed,
    'pnl', v_pnl,
    'fib_index', v_fib_index,
    'running', v_running,
    'stop_reason', v_stop_reason
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_bet_apply_outcome_v1(jsonb, bigint, int, int, bigint, text, bigint) FROM PUBLIC, anon, authenticated;

-- ─── Consent ─────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_bet_grant_consent_v1()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.ensure_user_settings_v1(v_uid);
  UPDATE public.user_settings
  SET auto_bet_consent_at = now(), updated_at = now()
  WHERE user_id = v_uid;
  RETURN json_build_object('ok', true, 'consent_at', now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_grant_consent_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_grant_consent_v1() FROM PUBLIC, anon;

-- ─── Create / pause / resume / stop / list / sync ────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_bet_create_v1(
  p_game text,
  p_config jsonb,
  p_bet_params jsonb DEFAULT '{}'::jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := lower(trim(p_game));
  v_settings public.user_settings%ROWTYPE;
  v_active int;
  v_base_bet bigint;
  v_bankroll bigint := 0;
  v_row public.auto_bet_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  IF EXISTS (SELECT 1 FROM public.game_authority_flags WHERE key = 'kill_switch' AND enabled) THEN
    RAISE EXCEPTION 'KILL_SWITCH_ACTIVE';
  END IF;

  IF NOT public.game_authority_flag_v1('auto_bet_server') THEN
    RAISE EXCEPTION 'AUTO_BET_SERVER_DISABLED';
  END IF;

  IF v_game NOT IN ('dice', 'limbo', 'wheel') THEN
    RAISE EXCEPTION 'AUTO_BET_GAME_UNSUPPORTED' USING ERRCODE = '22000';
  END IF;

  v_settings := public.ensure_user_settings_v1(v_uid);
  IF v_settings.auto_bet_consent_at IS NULL THEN
    RAISE EXCEPTION 'AUTO_BET_CONSENT_REQUIRED';
  END IF;

  SELECT count(*)::int INTO v_active
  FROM public.auto_bet_sessions
  WHERE user_id = v_uid AND status IN ('running', 'paused', 'stopping');
  IF v_active >= 3 THEN
    RAISE EXCEPTION 'AUTO_BET_MAX_SESSIONS' USING ERRCODE = '22000';
  END IF;

  v_base_bet := greatest(1, coalesce((p_config->>'baseBet')::bigint, (p_config->>'base_bet')::bigint, 1));

  SELECT coalesce(phon, 0) INTO v_bankroll
  FROM public.wallet_balances WHERE user_id = v_uid;

  INSERT INTO public.auto_bet_sessions (
    user_id, game, status, config, bet_params, current_bet, starting_bankroll_phon, next_tick_at
  ) VALUES (
    v_uid, v_game, 'running', p_config, coalesce(p_bet_params, '{}'::jsonb),
    v_base_bet, v_bankroll, now()
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'game', v_row.game,
    'status', v_row.status,
    'config', v_row.config,
    'bet_params', v_row.bet_params,
    'current_bet', v_row.current_bet,
    'bets_placed', v_row.bets_placed,
    'pnl', v_row.pnl,
    'fib_index', v_row.fib_index,
    'stop_reason', v_row.stop_reason,
    'next_tick_at', v_row.next_tick_at,
    'created_at', v_row.created_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_create_v1(text, jsonb, jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_create_v1(text, jsonb, jsonb) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auto_bet_pause_v1(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.auto_bet_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_row FROM public.auto_bet_sessions WHERE id = p_session_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTO_BET_NOT_FOUND'; END IF;
  IF v_row.status <> 'running' THEN
    RETURN json_build_object('id', v_row.id, 'status', v_row.status);
  END IF;
  UPDATE public.auto_bet_sessions SET status = 'paused', updated_at = now() WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN json_build_object('id', v_row.id, 'status', v_row.status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_pause_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_pause_v1(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auto_bet_resume_v1(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.auto_bet_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF EXISTS (SELECT 1 FROM public.game_authority_flags WHERE key = 'kill_switch' AND enabled) THEN
    RAISE EXCEPTION 'KILL_SWITCH_ACTIVE';
  END IF;
  SELECT * INTO v_row FROM public.auto_bet_sessions WHERE id = p_session_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTO_BET_NOT_FOUND'; END IF;
  IF v_row.status = 'paused' THEN
    UPDATE public.auto_bet_sessions
    SET status = 'running', next_tick_at = now(), updated_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;
  RETURN json_build_object('id', v_row.id, 'status', v_row.status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_resume_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_resume_v1(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auto_bet_stop_v1(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.auto_bet_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_row FROM public.auto_bet_sessions WHERE id = p_session_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTO_BET_NOT_FOUND'; END IF;
  IF v_row.status IN ('stopped', 'completed', 'error') THEN
    RETURN json_build_object('id', v_row.id, 'status', v_row.status, 'stop_reason', v_row.stop_reason);
  END IF;
  UPDATE public.auto_bet_sessions
  SET status = 'stopped', stop_reason = 'manual', stopped_at = now(), updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;
  RETURN json_build_object('id', v_row.id, 'status', v_row.status, 'stop_reason', v_row.stop_reason);
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_stop_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_stop_v1(uuid) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auto_bet_list_v1()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  RETURN json_build_object(
    'items',
    coalesce((
      SELECT json_agg(json_build_object(
        'id', s.id,
        'game', s.game,
        'status', s.status,
        'current_bet', s.current_bet,
        'bets_placed', s.bets_placed,
        'pnl', s.pnl,
        'stop_reason', s.stop_reason,
        'next_tick_at', s.next_tick_at,
        'updated_at', s.updated_at,
        'created_at', s.created_at
      ) ORDER BY s.updated_at DESC)
      FROM public.auto_bet_sessions s
      WHERE s.user_id = v_uid
        AND s.status IN ('running', 'paused', 'stopping')
    ), '[]'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_list_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_list_v1() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.auto_bet_sync_v1(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.auto_bet_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  SELECT * INTO v_row FROM public.auto_bet_sessions WHERE id = p_session_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'AUTO_BET_NOT_FOUND'; END IF;
  RETURN json_build_object(
    'id', v_row.id,
    'game', v_row.game,
    'status', v_row.status,
    'config', v_row.config,
    'bet_params', v_row.bet_params,
    'current_bet', v_row.current_bet,
    'bets_placed', v_row.bets_placed,
    'pnl', v_row.pnl,
    'fib_index', v_row.fib_index,
    'stop_reason', v_row.stop_reason,
    'last_error', v_row.last_error,
    'next_tick_at', v_row.next_tick_at,
    'updated_at', v_row.updated_at
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.auto_bet_sync_v1(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.auto_bet_sync_v1(uuid) FROM PUBLIC, anon;

-- ─── Worker: place one round + apply strategy ────────────────────────────────

CREATE OR REPLACE FUNCTION public.auto_bet_execute_round_v1(p_session_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auto_bet_sessions%ROWTYPE;
  v_settings public.user_settings%ROWTYPE;
  v_round_id text;
  v_place json;
  v_outcome text;
  v_delta bigint := 0;
  v_step jsonb;
  v_running boolean;
  v_balance bigint;
  v_today date := (timezone('utc', now()))::date;
  v_daily_rounds int;
BEGIN
  SELECT * INTO v_row FROM public.auto_bet_sessions WHERE id = p_session_id FOR UPDATE;
  IF NOT FOUND OR v_row.status <> 'running' THEN
    RETURN json_build_object('skipped', true, 'reason', 'not_running');
  END IF;

  v_settings := public.ensure_user_settings_v1(v_row.user_id);

  IF v_row.daily_rounds_date <> v_today THEN
    v_daily_rounds := 0;
  ELSE
    v_daily_rounds := v_row.daily_rounds_today;
  END IF;

  IF v_daily_rounds >= v_settings.daily_round_limit THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
        last_error = 'daily_round_limit'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'daily_round_limit');
  END IF;

  IF v_settings.daily_loss_limit_phon IS NOT NULL AND v_row.pnl <= -v_settings.daily_loss_limit_phon THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
        last_error = 'daily_loss_limit_phon'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'daily_loss_limit_phon');
  END IF;

  IF v_settings.daily_loss_limit_pct IS NOT NULL AND v_row.starting_bankroll_phon > 0 THEN
    IF v_row.pnl <= -round(v_row.starting_bankroll_phon::numeric * v_settings.daily_loss_limit_pct / 100.0)::bigint THEN
      UPDATE public.auto_bet_sessions
      SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
          last_error = 'daily_loss_limit_pct'
      WHERE id = v_row.id;
      RETURN json_build_object('stopped', true, 'reason', 'daily_loss_limit_pct');
    END IF;
  END IF;

  IF v_settings.max_consecutive_losses IS NOT NULL AND v_row.consecutive_losses >= v_settings.max_consecutive_losses THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'limit', stopped_at = now(), updated_at = now(),
        last_error = 'max_consecutive_losses'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'max_consecutive_losses');
  END IF;

  PERFORM public.auto_bet_internal_set_uid(v_row.user_id);

  SELECT coalesce(phon, 0) INTO v_balance FROM public.wallet_balances WHERE user_id = v_row.user_id;
  IF v_balance < v_row.current_bet AND public.resolve_user_mode_v1() = 'real' THEN
    UPDATE public.auto_bet_sessions
    SET status = 'stopped', stop_reason = 'error', stopped_at = now(), updated_at = now(),
        last_error = 'insufficient_funds'
    WHERE id = v_row.id;
    RETURN json_build_object('stopped', true, 'reason', 'insufficient_funds');
  END IF;

  v_round_id := 'autobet-' || replace(v_row.id::text, '-', '') || '-n' || (v_row.bets_placed + 1)::text;

  BEGIN
    CASE v_row.game
      WHEN 'dice' THEN
        v_place := public.dice_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'target')::numeric, 50),
          coalesce(v_row.bet_params->>'dice_mode', 'over'),
          NULL
        );
      WHEN 'limbo' THEN
        v_place := public.limbo_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'target')::numeric, 2.0),
          NULL
        );
      WHEN 'wheel' THEN
        v_place := public.wheel_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce(v_row.bet_params->>'risk', 'medium'),
          coalesce((v_row.bet_params->>'segments')::int, 10),
          NULL
        );
      ELSE
        RAISE EXCEPTION 'AUTO_BET_GAME_UNSUPPORTED';
    END CASE;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.auto_bet_sessions
      SET status = 'stopped', stop_reason = 'error', stopped_at = now(), updated_at = now(),
          last_error = left(SQLERRM, 200)
      WHERE id = v_row.id;
      RETURN json_build_object('stopped', true, 'reason', 'place_error', 'error', SQLERRM);
  END;

  v_delta := coalesce((v_place->>'profit')::bigint, 0);
  IF v_delta > 0 THEN
    v_outcome := 'win';
  ELSIF v_delta < 0 THEN
    v_outcome := 'loss';
  ELSIF coalesce((v_place->>'won')::boolean, false) THEN
    v_outcome := 'win';
  ELSE
    v_outcome := 'loss';
  END IF;

  v_step := public.auto_bet_apply_outcome_v1(
    v_row.config, v_row.current_bet, v_row.fib_index, v_row.bets_placed, v_row.pnl,
    v_outcome, v_delta
  );
  v_running := coalesce((v_step->>'running')::boolean, false);

  UPDATE public.auto_bet_sessions
  SET
    current_bet = (v_step->>'current_bet')::bigint,
    bets_placed = (v_step->>'bets_placed')::int,
    pnl = (v_step->>'pnl')::bigint,
    fib_index = (v_step->>'fib_index')::int,
    consecutive_losses = CASE WHEN v_outcome = 'loss' THEN consecutive_losses + 1 ELSE 0 END,
    daily_rounds_today = CASE WHEN daily_rounds_date = v_today THEN daily_rounds_today + 1 ELSE 1 END,
    daily_rounds_date = v_today,
    status = CASE
      WHEN NOT v_running THEN 'completed'
      ELSE 'running'
    END,
    stop_reason = CASE WHEN NOT v_running THEN coalesce(v_step->>'stop_reason', 'count') ELSE stop_reason END,
    stopped_at = CASE WHEN NOT v_running THEN now() ELSE stopped_at END,
    last_tick_at = now(),
    next_tick_at = now() + interval '1 second',
    updated_at = now(),
    last_error = NULL
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'session_id', v_row.id,
    'placed', true,
    'outcome', v_outcome,
    'delta', v_delta,
    'status', v_row.status,
    'bets_placed', v_row.bets_placed,
    'pnl', v_row.pnl,
    'current_bet', v_row.current_bet
  );
END;
$$;

REVOKE ALL ON FUNCTION public.auto_bet_execute_round_v1(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.auto_bet_worker_tick_v1(p_batch_limit int DEFAULT 100)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.auto_bet_sessions%ROWTYPE;
  v_processed int := 0;
  v_limit int := greatest(1, least(coalesce(p_batch_limit, 100), 500));
BEGIN
  IF EXISTS (SELECT 1 FROM public.game_authority_flags WHERE key = 'kill_switch' AND enabled) THEN
    RETURN 0;
  END IF;

  FOR v_row IN
    SELECT * FROM public.auto_bet_sessions
    WHERE status = 'running' AND next_tick_at <= now()
    ORDER BY next_tick_at
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  LOOP
    PERFORM public.auto_bet_execute_round_v1(v_row.id);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN v_processed;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_bet_worker_tick_v1(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_bet_worker_tick_v1(int) TO service_role;

-- ─── Feature flag ────────────────────────────────────────────────────────────

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES ('auto_bet_server', true, 100, 'GA-J server auto-bet worker (verified → 100%)')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percent = EXCLUDED.rollout_percent,
  description = EXCLUDED.description,
  updated_at = now();

-- ─── RPC hardening ───────────────────────────────────────────────────────────

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.auto_bet_fib_at(int)'::regprocedure,
    'public.auto_bet_apply_outcome_v1(jsonb,bigint,int,int,bigint,text,bigint)'::regprocedure,
    'public.auto_bet_execute_round_v1(uuid)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;
