-- Fix mode switch 403 (ACTIVE_GAME_SESSION) caused by stale demo animation sessions.
-- Auto-bet instant-settle games (dice/limbo/wheel) left game_active_sessions active.

-- ─── user_set_preferred_mode_v1 — auto-settle safe stale demo sessions ───────

CREATE OR REPLACE FUNCTION public.user_set_preferred_mode_v1(p_mode text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF p_mode NOT IN ('demo', 'real') THEN RAISE EXCEPTION 'INVALID_MODE'; END IF;

  IF public.auth_is_anonymous() AND p_mode = 'real' THEN
    RAISE EXCEPTION 'ANON_CANNOT_SET_REAL' USING ERRCODE = '42501';
  END IF;

  -- Demo instant-settle rounds with fixed outcomes (animation_pending) are safe to clear.
  UPDATE public.game_active_sessions
  SET
    status = 'settled',
    client_state = client_state || jsonb_build_object('animation_pending', false),
    updated_at = now()
  WHERE user_id = v_uid
    AND status = 'active'
    AND bet_amount = 0
    AND COALESCE(client_state->>'bet_mode', 'demo') = 'demo'
    AND COALESCE((client_state->>'animation_pending')::boolean, false) = true
    AND client_state ? 'won';

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'ACTIVE_GAME_SESSION' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_settings (user_id, preferred_mode)
  VALUES (v_uid, p_mode)
  ON CONFLICT (user_id) DO UPDATE
    SET preferred_mode = EXCLUDED.preferred_mode,
        updated_at = now()
  RETURNING * INTO v_row;

  RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_set_preferred_mode_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.user_set_preferred_mode_v1(text) FROM PUBLIC, anon;

-- ─── auto_bet_execute_round_v1 — complete instant-settle sessions ────────────

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
  v_plinko_complete json;
  v_crash_settle json;
  v_mines_result json;
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
        PERFORM public.dice_complete_v1(v_round_id);
      WHEN 'limbo' THEN
        v_place := public.limbo_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'target')::numeric, 2.0),
          NULL
        );
        PERFORM public.limbo_complete_v1(v_round_id);
      WHEN 'wheel' THEN
        v_place := public.wheel_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce(v_row.bet_params->>'risk', 'medium'),
          coalesce((v_row.bet_params->>'segments')::int, 10),
          NULL
        );
        PERFORM public.wheel_complete_v1(v_round_id);
      WHEN 'plinko' THEN
        v_place := public.plinko_enqueue_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'rows')::int, 12),
          coalesce(v_row.bet_params->>'risk', 'medium'),
          NULL
        );
        v_plinko_complete := public.plinko_complete_v1(v_round_id);
        v_place := json_build_object(
          'profit', coalesce((v_plinko_complete->>'profit')::bigint, (v_place->>'profit')::bigint, 0),
          'won', coalesce((v_plinko_complete->>'won')::boolean, false),
          'multiplier', coalesce(v_plinko_complete->>'multiplier', v_place->>'multiplier'),
          'round_id', v_round_id
        );
      WHEN 'crash' THEN
        UPDATE public.auto_bet_sessions
        SET game_phase = 'placed', current_round_id = v_round_id, phase_started_at = now()
        WHERE id = v_row.id;

        v_place := public.crash_place_v1(
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'auto_target_e6')::bigint, 2000000),
          NULL
        );

        v_crash_settle := public.auto_bet_crash_settle_internal(v_round_id, v_row.user_id);

        UPDATE public.auto_bet_sessions
        SET game_phase = 'idle', current_round_id = NULL, phase_started_at = NULL
        WHERE id = v_row.id;

        v_place := json_build_object(
          'profit', coalesce((v_crash_settle->>'profit')::bigint, 0),
          'won', coalesce((v_crash_settle->>'won')::boolean, false),
          'crash_point_e6', (v_crash_settle->>'crash_point_e6')::bigint,
          'round_id', v_round_id
        );
      WHEN 'mines' THEN
        UPDATE public.auto_bet_sessions
        SET game_phase = 'mines_revealing', current_round_id = v_round_id, phase_started_at = now()
        WHERE id = v_row.id;

        v_mines_result := public.auto_bet_mines_execute_v1(
          v_row.user_id,
          v_row.current_bet,
          v_round_id,
          coalesce((v_row.bet_params->>'mine_count')::int, 3),
          coalesce((v_row.bet_params->>'reveal_count')::int, 1)
        );

        UPDATE public.auto_bet_sessions
        SET game_phase = 'idle', current_round_id = NULL, phase_started_at = NULL
        WHERE id = v_row.id;

        v_place := json_build_object(
          'profit', coalesce((v_mines_result->>'profit')::bigint, 0),
          'won', coalesce((v_mines_result->>'won')::boolean, false),
          'round_id', v_round_id
        );
      ELSE
        RAISE EXCEPTION 'AUTO_BET_GAME_UNSUPPORTED';
    END CASE;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.auto_bet_sessions
      SET status = 'stopped', stop_reason = 'error', stopped_at = now(), updated_at = now(),
          last_error = left(SQLERRM, 200),
          game_phase = 'idle', current_round_id = NULL, phase_started_at = NULL
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
