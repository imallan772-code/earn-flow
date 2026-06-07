-- GA-I: Plinko server-authoritative path (HMAC PF) + queue + stale auto-settle.
-- Template: GA-H Wheel MULTIPLIERS SSOT + queue defer credit until complete.
-- Does NOT touch live_bets triggers or autobot paths.

-- ─── plinko_queue ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.plinko_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  round_id text NOT NULL,
  bet_amount bigint NOT NULL DEFAULT 0,
  rows int NOT NULL CHECK (rows IN (8, 12, 16)),
  risk text NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  path int[] NOT NULL,
  final_slot int NOT NULL,
  multiplier numeric NOT NULL,
  gross_payout bigint NOT NULL DEFAULT 0,
  profit bigint NOT NULL DEFAULT 0,
  bet_mode text NOT NULL CHECK (bet_mode IN ('demo', 'real')),
  pf_nonce bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT plinko_queue_user_round_unique UNIQUE (user_id, round_id)
);

CREATE INDEX IF NOT EXISTS plinko_queue_pending_idx
  ON public.plinko_queue (user_id, status, created_at)
  WHERE status = 'pending';

ALTER TABLE public.plinko_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plinko_queue_select_own ON public.plinko_queue;
CREATE POLICY plinko_queue_select_own ON public.plinko_queue
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON TABLE public.plinko_queue FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.plinko_queue TO authenticated;

-- ─── Multiplier tables (server SSOT — PlinkoEngine.ts MULTIPLIERS) ───────────

CREATE OR REPLACE FUNCTION public.plinko_get_multipliers(p_risk text, p_rows int)
RETURNS numeric[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(trim(p_risk)) = 'low' AND p_rows = 8
      THEN ARRAY[5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6]::numeric[]
    WHEN lower(trim(p_risk)) = 'low' AND p_rows = 12
      THEN ARRAY[10, 3, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3, 10]::numeric[]
    WHEN lower(trim(p_risk)) = 'low' AND p_rows = 16
      THEN ARRAY[16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1.0, 0.5, 1.0, 1.1, 1.2, 1.4, 1.4, 2, 9, 16]::numeric[]
    WHEN lower(trim(p_risk)) = 'medium' AND p_rows = 8
      THEN ARRAY[13, 3, 1.3, 0.7, 0.4, 0.7, 1.3, 3, 13]::numeric[]
    WHEN lower(trim(p_risk)) = 'medium' AND p_rows = 12
      THEN ARRAY[33, 11, 4, 2, 1.1, 0.6, 0.3, 0.6, 1.1, 2, 4, 11, 33]::numeric[]
    WHEN lower(trim(p_risk)) = 'medium' AND p_rows = 16
      THEN ARRAY[110, 41, 10, 5, 3, 1.5, 1.0, 0.5, 0.3, 0.5, 1.0, 1.5, 3, 5, 10, 41, 110]::numeric[]
    WHEN lower(trim(p_risk)) = 'high' AND p_rows = 8
      THEN ARRAY[29, 4, 1.5, 0.3, 0.2, 0.3, 1.5, 4, 29]::numeric[]
    WHEN lower(trim(p_risk)) = 'high' AND p_rows = 12
      THEN ARRAY[76, 18, 5, 2, 0.7, 0.2, 0.2, 0.2, 0.7, 2, 5, 18, 76]::numeric[]
    WHEN lower(trim(p_risk)) = 'high' AND p_rows = 16
      THEN ARRAY[1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000]::numeric[]
    ELSE ARRAY[]::numeric[]
  END;
$$;

REVOKE ALL ON FUNCTION public.plinko_get_multipliers(text, int) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.plinko_multiplier_at(p_risk text, p_rows int, p_slot int)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_arr numeric[];
  v_len int;
  v_safe int;
BEGIN
  v_arr := public.plinko_get_multipliers(p_risk, p_rows);
  v_len := COALESCE(array_length(v_arr, 1), 0);
  IF v_len = 0 THEN RETURN 0; END IF;
  v_safe := GREATEST(0, LEAST(v_len - 1, floor(p_slot)::int));
  RETURN v_arr[v_safe + 1];
END;
$$;

REVOKE ALL ON FUNCTION public.plinko_multiplier_at(text, int, int) FROM PUBLIC, anon, authenticated;

-- ─── HMAC path (cursor = row index 0..rows-1) ────────────────────────────────

CREATE OR REPLACE FUNCTION public.plinko_compute_path(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint,
  p_rows int
)
RETURNS json
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_i int;
  v_u double precision;
  v_dir int;
  v_path int[] := ARRAY[]::int[];
  v_final int := 0;
BEGIN
  IF p_rows NOT IN (8, 12, 16) THEN
    RAISE EXCEPTION 'PLINKO_INVALID_ROWS';
  END IF;
  FOR v_i IN 0..(p_rows - 1) LOOP
    v_u := public.pf_draw_float(p_server_seed, p_client_seed, p_nonce, v_i);
    v_dir := CASE WHEN v_u < 0.5 THEN 0 ELSE 1 END;
    v_path := v_path || v_dir;
    v_final := v_final + v_dir;
  END LOOP;
  RETURN json_build_object('path', v_path, 'final_slot', v_final);
END;
$$;

REVOKE ALL ON FUNCTION public.plinko_compute_path(text, text, bigint, int) FROM PUBLIC, anon, authenticated;

-- ─── Internal: complete one pending row (credit + mark completed) ────────────

CREATE OR REPLACE FUNCTION public.plinko_complete_row_v1(p_row public.plinko_queue)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit json := NULL;
  v_gross bigint := 0;
  v_profit bigint := 0;
BEGIN
  IF p_row.status = 'completed' THEN
    RETURN json_build_object(
      'round_id', p_row.round_id,
      'already_completed', true,
      'multiplier', p_row.multiplier,
      'gross_payout', p_row.gross_payout,
      'profit', p_row.profit
    );
  END IF;

  v_gross := p_row.gross_payout;
  v_profit := p_row.profit;

  IF p_row.bet_mode = 'real' AND v_gross >= 1 THEN
    v_credit := public.credit_phon_for_payout_v2(v_gross, 'plinko', p_row.round_id);
  END IF;

  UPDATE public.plinko_queue
  SET status = 'completed', completed_at = now()
  WHERE id = p_row.id;

  RETURN json_build_object(
    'round_id', p_row.round_id,
    'multiplier', p_row.multiplier,
    'gross_payout', v_gross,
    'profit', v_profit,
    'credit', v_credit
  );
END;
$$;

REVOKE ALL ON FUNCTION public.plinko_complete_row_v1(public.plinko_queue) FROM PUBLIC, anon, authenticated;

-- ─── plinko_enqueue_v1 — debit + HMAC path + queue pending ───────────────────

CREATE OR REPLACE FUNCTION public.plinko_enqueue_v1(
  p_amount bigint,
  p_round_id text,
  p_rows int,
  p_risk text,
  p_client_seed text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round text := trim(p_round_id);
  v_mode text;
  v_pf json;
  v_session public.pf_sessions%ROWTYPE;
  v_used_nonce bigint;
  v_risk text := lower(trim(p_risk));
  v_path_json json;
  v_path int[];
  v_final int;
  v_mult numeric;
  v_debit json := NULL;
  v_gross bigint := 0;
  v_profit bigint := 0;
  v_existing public.plinko_queue%ROWTYPE;
  v_row public.plinko_queue%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF v_risk NOT IN ('low', 'medium', 'high') THEN RAISE EXCEPTION 'PLINKO_INVALID_RISK'; END IF;
  IF p_rows NOT IN (8, 12, 16) THEN RAISE EXCEPTION 'PLINKO_INVALID_ROWS'; END IF;

  SELECT * INTO v_existing FROM public.plinko_queue
  WHERE user_id = v_uid AND round_id = v_round;

  IF FOUND THEN
    IF v_existing.status = 'pending' THEN
      RETURN public.plinko_sync_v1(v_round);
    END IF;
    RAISE EXCEPTION 'PLINKO_ROUND_ALREADY_COMPLETED' USING ERRCODE = '23505';
  END IF;

  v_mode := public.resolve_user_mode_v1();

  IF v_mode = 'real' THEN
    PERFORM public.money_validate_bet_input(p_amount, 'plinko', v_round);
  END IF;

  v_pf := public.pf_session_create_or_get_v1('plinko', p_client_seed);
  SELECT * INTO v_session FROM public.pf_sessions WHERE id = (v_pf->>'id')::uuid FOR UPDATE;
  v_used_nonce := v_session.nonce;

  v_path_json := public.plinko_compute_path(v_session.server_seed, v_session.client_seed, v_used_nonce, p_rows);
  SELECT COALESCE(array_agg(elem::int ORDER BY ord), ARRAY[]::int[])
  INTO v_path
  FROM json_array_elements_text(v_path_json->'path') WITH ORDINALITY AS t(elem, ord);
  v_final := (v_path_json->>'final_slot')::int;
  v_mult := public.plinko_multiplier_at(v_risk, p_rows, v_final);

  IF v_mode = 'real' THEN
    v_debit := public.debit_phon_for_bet_v2(p_amount, 'plinko', v_round);
    v_gross := round(p_amount::numeric * v_mult)::bigint;
    v_profit := v_gross - p_amount;
  END IF;

  UPDATE public.pf_sessions SET nonce = nonce + 1 WHERE id = v_session.id;

  INSERT INTO public.plinko_queue (
    user_id, round_id, bet_amount, rows, risk, path, final_slot, multiplier,
    gross_payout, profit, bet_mode, pf_nonce, status
  ) VALUES (
    v_uid, v_round,
    CASE WHEN v_mode = 'real' THEN p_amount ELSE 0 END,
    p_rows, v_risk, v_path, v_final, v_mult,
    v_gross, v_profit, v_mode, v_used_nonce, 'pending'
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'round_id', v_round,
    'mode', v_mode,
    'nonce', v_used_nonce,
    'next_nonce', v_used_nonce + 1,
    'rows', p_rows,
    'risk', v_risk,
    'path', v_path,
    'final_slot', v_final,
    'multiplier', v_mult,
    'gross_payout', v_gross,
    'profit', v_profit,
    'status', 'pending',
    'server_seed_hash', v_session.server_seed_hash,
    'debit', v_debit,
    'queue_id', v_row.id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plinko_enqueue_v1(bigint, text, int, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.plinko_enqueue_v1(bigint, text, int, text, text) FROM PUBLIC, anon;

-- ─── plinko_sync_v1 — resume pending ball ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.plinko_sync_v1(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round text := trim(p_round_id);
  v_row public.plinko_queue%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_row FROM public.plinko_queue
  WHERE user_id = v_uid AND round_id = v_round;

  IF NOT FOUND THEN
    RETURN json_build_object('status', 'idle');
  END IF;

  IF v_row.status = 'completed' THEN
    RETURN json_build_object(
      'status', 'completed',
      'round_id', v_round,
      'multiplier', v_row.multiplier,
      'final_slot', v_row.final_slot,
      'gross_payout', v_row.gross_payout,
      'profit', v_row.profit
    );
  END IF;

  RETURN json_build_object(
    'status', 'pending_animation',
    'round_id', v_round,
    'mode', v_row.bet_mode,
    'nonce', v_row.pf_nonce,
    'rows', v_row.rows,
    'risk', v_row.risk,
    'path', v_row.path,
    'final_slot', v_row.final_slot,
    'multiplier', v_row.multiplier,
    'gross_payout', v_row.gross_payout,
    'profit', v_row.profit,
    'stake_amount', v_row.bet_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.plinko_sync_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.plinko_sync_v1(text) FROM PUBLIC, anon;

-- ─── plinko_list_pending_v1 — resume queue on remount ────────────────────────

CREATE OR REPLACE FUNCTION public.plinko_list_pending_v1()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_items json;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT COALESCE(json_agg(
    json_build_object(
      'round_id', q.round_id,
      'mode', q.bet_mode,
      'nonce', q.pf_nonce,
      'rows', q.rows,
      'risk', q.risk,
      'path', q.path,
      'final_slot', q.final_slot,
      'multiplier', q.multiplier,
      'stake_amount', q.bet_amount,
      'gross_payout', q.gross_payout,
      'profit', q.profit,
      'created_at', (extract(epoch from q.created_at) * 1000)::bigint
    ) ORDER BY q.created_at ASC
  ), '[]'::json)
  INTO v_items
  FROM public.plinko_queue q
  WHERE q.user_id = v_uid AND q.status = 'pending';

  RETURN json_build_object('status', 'ok', 'items', v_items);
END;
$$;

GRANT EXECUTE ON FUNCTION public.plinko_list_pending_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.plinko_list_pending_v1() FROM PUBLIC, anon;

-- ─── plinko_complete_v1 — land callback: credit + completed ──────────────────

CREATE OR REPLACE FUNCTION public.plinko_complete_v1(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_round text := trim(p_round_id);
  v_row public.plinko_queue%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_row FROM public.plinko_queue
  WHERE user_id = v_uid AND round_id = v_round
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN public.plinko_complete_row_v1(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.plinko_complete_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.plinko_complete_v1(text) FROM PUBLIC, anon;

-- ─── plinko_force_settle_stale_v1 — 5min+ pending auto-settle (refund X) ─────

CREATE OR REPLACE FUNCTION public.plinko_force_settle_stale_v1(p_max_age_ms bigint DEFAULT 300000)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.plinko_queue%ROWTYPE;
  v_count int := 0;
  v_cutoff timestamptz := now() - (p_max_age_ms || ' milliseconds')::interval;
BEGIN
  FOR v_row IN
    SELECT * FROM public.plinko_queue
    WHERE status = 'pending' AND created_at < v_cutoff
    ORDER BY created_at ASC
    FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.plinko_complete_row_v1(v_row);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.plinko_force_settle_stale_v1(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.plinko_force_settle_stale_v1(bigint) TO service_role;

-- ─── Feature flag ────────────────────────────────────────────────────────────

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES ('plinko_server_settle', true, 100, 'GA-I Plinko HMAC path + queue server authority (verified → 100%)')
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
    'public.plinko_get_multipliers(text,int)'::regprocedure,
    'public.plinko_multiplier_at(text,int,int)'::regprocedure,
    'public.plinko_compute_path(text,text,bigint,int)'::regprocedure,
    'public.plinko_complete_row_v1(public.plinko_queue)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.plinko_enqueue_v1(bigint,text,int,text,text)'::regprocedure,
    'public.plinko_sync_v1(text)'::regprocedure,
    'public.plinko_list_pending_v1()'::regprocedure,
    'public.plinko_complete_v1(text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

ALTER FUNCTION public.plinko_compute_path(text, text, bigint, int) SET search_path = public, extensions;
