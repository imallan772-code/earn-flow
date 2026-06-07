-- Fix plinko_enqueue_v1: live function references 'mode' column instead of 'bet_mode'.
-- This replaces the stale deployed version with the correct one from GA-I migration.

-- Drop and recreate because live version has different parameter defaults.
DROP FUNCTION IF EXISTS public.plinko_enqueue_v1(bigint, text, int, text, text);

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

  PERFORM public.assert_kill_switch_not_active();

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
