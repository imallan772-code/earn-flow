-- P0: mines_cashout_v2 demo mode — skip credit when bet_amount=0 (align with crash_cashout_v1).

CREATE OR REPLACE FUNCTION public.mines_cashout_v2(p_round_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'mines';
  v_round text := trim(p_round_id);
  v_session public.game_active_sessions%ROWTYPE;
  v_revealed jsonb;
  v_mine_count int;
  v_mult double precision;
  v_gross_payout bigint;
  v_mode text;
  v_credit json := NULL;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_session FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'MINES_SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_revealed := COALESCE(v_session.client_state->'revealed', '[]'::jsonb);
  IF jsonb_array_length(v_revealed) < 1 THEN RAISE EXCEPTION 'MINES_CASHOUT_NO_REVEALS'; END IF;

  v_mine_count := COALESCE((v_session.client_state->>'mine_count')::int, 1);
  v_mult := public.mines_next_multiplier(jsonb_array_length(v_revealed), v_mine_count);
  v_mode := COALESCE(v_session.client_state->>'bet_mode', 'demo');
  v_gross_payout := round(v_session.bet_amount::numeric * v_mult)::bigint;

  IF v_gross_payout < 0 THEN RAISE EXCEPTION 'MINES_CASHOUT_INVALID_PAYOUT'; END IF;

  IF v_mode = 'real' AND v_session.bet_amount > 0 AND v_gross_payout >= 1 THEN
    v_credit := public.credit_phon_for_payout_v2(v_gross_payout, v_game, v_round);
  END IF;

  UPDATE public.game_active_sessions SET status = 'settled', updated_at = now() WHERE id = v_session.id;

  RETURN json_build_object(
    'credit', v_credit,
    'round_id', v_round,
    'gross_payout', v_gross_payout,
    'multiplier', v_mult,
    'revealed', v_revealed,
    'mode', v_mode
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mines_cashout_v2(text) TO authenticated;
REVOKE ALL ON FUNCTION public.mines_cashout_v2(text) FROM PUBLIC, anon;
