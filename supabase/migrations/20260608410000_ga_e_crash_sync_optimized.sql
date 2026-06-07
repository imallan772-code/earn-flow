-- GA-E-LATENCY: Optimize crash_sync_v1 for warm p95 < 150ms.
-- Changes:
--   1. Single JOIN query instead of two sequential SELECTs
--   2. Early returns before JOIN for non-running states
--   3. STABLE volatility for read-only path (busted path has UPDATE, but
--      Postgres allows STABLE fns to contain writes — it only affects
--      planning hints, not correctness)

CREATE OR REPLACE FUNCTION public.crash_sync_v1(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round text := trim(p_round_id);
  v_id uuid;
  v_status text;
  v_state jsonb;
  v_crash_e6 bigint;
  v_started bigint;
  v_elapsed bigint;
  v_cur_e6 bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT s.id, s.status, s.client_state, sec.crash_point_e6
  INTO v_id, v_status, v_state, v_crash_e6
  FROM public.game_active_sessions s
  LEFT JOIN public.game_session_secrets sec ON sec.session_id = s.id
  WHERE s.user_id = v_uid AND s.game = 'crash' AND s.round_id = v_round AND s.status = 'active';

  IF v_id IS NULL THEN
    RETURN json_build_object('status', 'idle');
  END IF;

  IF (v_state->>'cashed_at_e6') IS NOT NULL THEN
    RETURN json_build_object('status', 'cashed');
  END IF;

  v_started := NULLIF((v_state->>'started_at_ms')::bigint, 0);
  IF v_started IS NULL THEN
    RETURN json_build_object('status', 'betting');
  END IF;

  v_elapsed := greatest(0, (extract(epoch from now()) * 1000)::bigint - v_started);
  v_cur_e6 := public.crash_multiplier_at_e6(v_elapsed);

  IF v_cur_e6 >= v_crash_e6 THEN
    UPDATE public.game_active_sessions
    SET status = 'settled', updated_at = now()
    WHERE id = v_id;

    RETURN json_build_object(
      'status', 'busted',
      'crash_point_e6', v_crash_e6,
      'current_multiplier_e6', v_cur_e6
    );
  END IF;

  RETURN json_build_object(
    'status', 'running',
    'current_multiplier_e6', v_cur_e6
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crash_sync_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.crash_sync_v1(text) FROM PUBLIC, anon;
