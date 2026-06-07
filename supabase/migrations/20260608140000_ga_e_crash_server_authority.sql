-- GA-E: Crash server-authoritative place/cashout/sync (RPC SSOT; Edge wraps these).
-- Does NOT touch live_bets triggers or autobot paths.

-- ─── Extend session secrets for crash (mines nullable for non-mines games) ───

ALTER TABLE public.game_session_secrets
  ALTER COLUMN mines DROP NOT NULL;

ALTER TABLE public.game_session_secrets
  ADD COLUMN IF NOT EXISTS crash_point_e6 bigint CHECK (crash_point_e6 IS NULL OR crash_point_e6 >= 1000000);

-- ─── Crash PF → crash point (Stake formula, matches CrashEngine.ts) ───────────

CREATE OR REPLACE FUNCTION public.crash_compute_point_e6(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint
)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_bytes bytea;
  v_h bigint;
  v_max numeric := 4294967296.0;
  v_cp numeric;
BEGIN
  v_bytes := public.pf_hmac_bytes(p_server_seed, p_client_seed, p_nonce, 0);
  v_h :=
    (get_byte(v_bytes, 0)::bigint << 24) +
    (get_byte(v_bytes, 1)::bigint << 16) +
    (get_byte(v_bytes, 2)::bigint << 8) +
    get_byte(v_bytes, 3)::bigint;

  IF (v_h % 100) = 0 THEN
    RETURN 1000000;
  END IF;

  v_cp := floor((100.0 * v_max - v_h) / (v_max - v_h) * 100.0) / 100.0;
  IF v_cp < 1.0 THEN
    v_cp := 1.0;
  END IF;

  RETURN round(v_cp * 1000000)::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.crash_compute_point_e6(text, text, bigint) FROM PUBLIC, anon, authenticated;

-- ─── Elapsed ms → multiplier e6 (GROWTH = 0.00006, matches CrashEngine) ─────

CREATE OR REPLACE FUNCTION public.crash_multiplier_at_e6(p_elapsed_ms bigint)
RETURNS bigint
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_growth constant double precision := 0.00006;
  v_m double precision;
BEGIN
  IF p_elapsed_ms <= 0 THEN
    RETURN 1000000;
  END IF;
  v_m := greatest(1.0, floor(exp(v_growth * p_elapsed_ms::double precision) * 100.0) / 100.0);
  RETURN round(v_m * 1000000)::bigint;
END;
$$;

REVOKE ALL ON FUNCTION public.crash_multiplier_at_e6(bigint) FROM PUBLIC, anon, authenticated;

-- ─── crash_place_v1 ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.crash_place_v1(
  p_amount bigint,
  p_round_id text,
  p_auto_target_e6 bigint DEFAULT NULL,
  p_client_seed text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'crash';
  v_round text := trim(p_round_id);
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_crash_e6 bigint;
  v_debit json;
  v_sess public.game_active_sessions%ROWTYPE;
  v_started bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND game = v_game AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'CRASH_ACTIVE_SESSION' USING ERRCODE = '42501';
  END IF;

  v_mode := public.resolve_user_mode_v1();

  v_pf := public.pf_session_create_or_get_v1(v_game, p_client_seed);
  SELECT * INTO v_session FROM public.pf_sessions WHERE id = (v_pf->>'id')::uuid;

  v_crash_e6 := public.crash_compute_point_e6(
    v_session.server_seed,
    v_session.client_seed,
    v_session.nonce
  );

  IF v_mode = 'real' THEN
    v_debit := public.debit_phon_for_bet_v2(p_amount, v_game, v_round);
  END IF;

  v_started := (extract(epoch from now()) * 1000)::bigint;

  INSERT INTO public.game_active_sessions (
    user_id, game, round_id, bet_amount, client_state, status
  ) VALUES (
    v_uid,
    v_game,
    v_round,
    CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
    jsonb_build_object(
      'nonce', v_session.nonce,
      'auto_target_e6', p_auto_target_e6,
      'cashed_at_e6', NULL,
      'started_at_ms', v_started,
      'bet_mode', v_mode,
      'pf_session_id', v_session.id
    ),
    'active'
  )
  RETURNING * INTO v_sess;

  INSERT INTO public.game_session_secrets (session_id, mines, crash_point_e6)
  VALUES (v_sess.id, NULL, v_crash_e6);

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'server_seed_hash', v_session.server_seed_hash,
    'nonce', v_session.nonce,
    'started_at_ms', v_started,
    'debit', v_debit,
    'session_id', v_sess.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crash_place_v1(bigint, text, bigint, text) TO authenticated;
REVOKE ALL ON FUNCTION public.crash_place_v1(bigint, text, bigint, text) FROM PUBLIC, anon;

-- ─── crash_cashout_v1 ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.crash_cashout_v1(
  p_round_id text,
  p_at_multiplier_e6 bigint
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'crash';
  v_round text := trim(p_round_id);
  v_sess public.game_active_sessions%ROWTYPE;
  v_secret public.game_session_secrets%ROWTYPE;
  v_crash_e6 bigint;
  v_started bigint;
  v_elapsed bigint;
  v_max_mult_e6 bigint;
  v_mode text;
  v_bet bigint;
  v_mult_e6 bigint;
  v_gross bigint := 0;
  v_credit json := NULL;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF p_at_multiplier_e6 IS NULL OR p_at_multiplier_e6 < 1000000 THEN
    RAISE EXCEPTION 'CRASH_INVALID_MULTIPLIER';
  END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'CRASH_SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_secret FROM public.game_session_secrets WHERE session_id = v_sess.id;
  v_crash_e6 := v_secret.crash_point_e6;
  IF v_crash_e6 IS NULL THEN RAISE EXCEPTION 'CRASH_SECRET_MISSING'; END IF;

  IF (v_sess.client_state->>'cashed_at_e6') IS NOT NULL THEN
    RAISE EXCEPTION 'CRASH_ALREADY_CASHED';
  END IF;

  v_started := COALESCE((v_sess.client_state->>'started_at_ms')::bigint, 0);
  v_elapsed := greatest(0, (extract(epoch from now()) * 1000)::bigint - v_started);
  v_max_mult_e6 := public.crash_multiplier_at_e6(v_elapsed);

  v_mult_e6 := least(p_at_multiplier_e6, v_max_mult_e6);

  IF v_mult_e6 >= v_crash_e6 THEN
    RAISE EXCEPTION 'CRASH_ALREADY_BUSTED';
  END IF;

  v_mode := COALESCE(v_sess.client_state->>'bet_mode', 'real');
  v_bet := v_sess.bet_amount;

  IF v_mode = 'real' AND v_bet > 0 THEN
    v_gross := round(v_bet::numeric * (v_mult_e6 / 1000000.0))::bigint;
    IF v_gross >= 1 THEN
      v_credit := public.credit_phon_for_payout_v2(v_gross, v_game, v_round);
    END IF;
  END IF;

  UPDATE public.game_active_sessions
  SET
    status = 'settled',
    client_state = v_sess.client_state || jsonb_build_object('cashed_at_e6', v_mult_e6),
    updated_at = now()
  WHERE id = v_sess.id;

  RETURN json_build_object(
    'round_id', v_round,
    'at_multiplier_e6', v_mult_e6,
    'crash_point_e6', v_crash_e6,
    'gross_payout', COALESCE(v_gross, 0),
    'credit', v_credit,
    'mode', v_mode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crash_cashout_v1(text, bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.crash_cashout_v1(text, bigint) FROM PUBLIC, anon;

-- ─── crash_sync_v1 — running/busted status without revealing early ───────────

CREATE OR REPLACE FUNCTION public.crash_sync_v1(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'crash';
  v_round text := trim(p_round_id);
  v_sess public.game_active_sessions%ROWTYPE;
  v_secret public.game_session_secrets%ROWTYPE;
  v_crash_e6 bigint;
  v_started bigint;
  v_elapsed bigint;
  v_cur_e6 bigint;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_sess FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active';

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'idle');
  END IF;

  IF (v_sess.client_state->>'cashed_at_e6') IS NOT NULL THEN
    RETURN json_build_object('status', 'cashed');
  END IF;

  SELECT * INTO v_secret FROM public.game_session_secrets WHERE session_id = v_sess.id;
  v_crash_e6 := v_secret.crash_point_e6;
  v_started := COALESCE((v_sess.client_state->>'started_at_ms')::bigint, 0);
  v_elapsed := greatest(0, (extract(epoch from now()) * 1000)::bigint - v_started);
  v_cur_e6 := public.crash_multiplier_at_e6(v_elapsed);

  IF v_cur_e6 >= v_crash_e6 THEN
    UPDATE public.game_active_sessions
    SET status = 'settled', updated_at = now()
    WHERE id = v_sess.id;

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

-- ─── crash_force_settle_stale_v1 — 60min max lifetime (cron) ─────────────────

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
BEGIN
  FOR v_row IN
    SELECT s.id, s.user_id, s.round_id, s.bet_amount, s.client_state, sec.crash_point_e6
    FROM public.game_active_sessions s
    JOIN public.game_session_secrets sec ON sec.session_id = s.id
    WHERE s.game = 'crash' AND s.status = 'active' AND s.created_at < v_cutoff
    FOR UPDATE OF s SKIP LOCKED
  LOOP
    IF (v_row.client_state->>'cashed_at_e6') IS NULL AND v_row.crash_point_e6 IS NOT NULL THEN
      -- auto_cashout path: if auto_target_e6 set and < crash, credit at auto (omitted v1 — loss default)
      UPDATE public.game_active_sessions SET status = 'settled', updated_at = now() WHERE id = v_row.id;
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.crash_force_settle_stale_v1(bigint) FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.crash_compute_point_e6(text, text, bigint) SET search_path = public, extensions;
ALTER FUNCTION public.crash_multiplier_at_e6(bigint) SET search_path = public;
