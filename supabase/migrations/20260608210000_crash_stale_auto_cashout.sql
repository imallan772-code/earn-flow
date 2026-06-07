-- GA-E §5.1: stale settle credits auto_cashout when eligible (real mode).

CREATE OR REPLACE FUNCTION public.crash_force_settle_stale_v1(p_max_age_ms bigint DEFAULT 3600000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_count int := 0;
  v_cutoff timestamptz := now() - (p_max_age_ms || ' milliseconds')::interval;
  v_auto_e6 bigint;
  v_mode text;
  v_started bigint;
  v_elapsed bigint;
  v_cur_e6 bigint;
  v_mult_e6 bigint;
  v_gross bigint;
  v_game text := 'crash';
BEGIN
  FOR v_row IN
    SELECT s.id, s.user_id, s.round_id, s.bet_amount, s.client_state, sec.crash_point_e6
    FROM public.game_active_sessions s
    JOIN public.game_session_secrets sec ON sec.session_id = s.id
    WHERE s.game = v_game AND s.status = 'active' AND s.created_at < v_cutoff
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    IF (v_row.client_state->>'cashed_at_e6') IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_auto_e6 := NULLIF((v_row.client_state->>'auto_target_e6')::bigint, 0);
    v_mode := COALESCE(v_row.client_state->>'bet_mode', 'real');
    v_started := NULLIF((v_row.client_state->>'started_at_ms')::bigint, 0);

    IF v_started IS NOT NULL THEN
      v_elapsed := greatest(0, (extract(epoch from now()) * 1000)::bigint - v_started);
      v_cur_e6 := public.crash_multiplier_at_e6(v_elapsed);
    ELSE
      v_cur_e6 := 1000000;
    END IF;

    IF v_auto_e6 IS NOT NULL
      AND v_auto_e6 < v_row.crash_point_e6
      AND v_cur_e6 >= v_auto_e6
    THEN
      v_mult_e6 := v_auto_e6;
      IF v_mode = 'real' AND v_row.bet_amount > 0 THEN
        v_gross := round(v_row.bet_amount::numeric * (v_mult_e6 / 1000000.0))::bigint;
        IF v_gross >= 1 THEN
          PERFORM public.credit_phon_for_payout_v2(v_gross, v_game, v_row.round_id);
        END IF;
      END IF;
      UPDATE public.game_active_sessions
      SET
        status = 'settled',
        client_state = v_row.client_state || jsonb_build_object('cashed_at_e6', v_mult_e6),
        updated_at = now()
      WHERE id = v_row.id;
    ELSE
      UPDATE public.game_active_sessions
      SET status = 'settled', updated_at = now()
      WHERE id = v_row.id;
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
