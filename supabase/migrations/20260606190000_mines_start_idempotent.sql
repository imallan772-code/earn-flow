-- Idempotent mines_start_round_v1: same round_id → resume (no double debit / 409)
-- Different active round → MINES_SESSION_ACTIVE (client must resume first)

CREATE OR REPLACE FUNCTION public.mines_start_round_v1(
  p_amount bigint,
  p_round_id text,
  p_mine_count int,
  p_client_seed text,
  p_nonce bigint,
  p_server_seed text DEFAULT 'phonara-mines-demo-server-seed-v1'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := 'mines';
  v_round text := trim(p_round_id);
  v_debit json;
  v_mines int[];
  v_session public.game_active_sessions%ROWTYPE;
  v_state jsonb;
  v_revealed jsonb;
  v_mine_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);

  SELECT * INTO v_session FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND status = 'active';

  IF FOUND THEN
    IF v_session.round_id = v_round THEN
      v_revealed := COALESCE(v_session.client_state->'revealed', '[]'::jsonb);
      v_mine_count := COALESCE((v_session.client_state->>'mine_count')::int, public.mines_clamp_count(p_mine_count));
      RETURN json_build_object(
        'debit', NULL,
        'session_id', v_session.id,
        'round_id', v_session.round_id,
        'bet_amount', v_session.bet_amount,
        'mine_count', v_mine_count,
        'nonce', COALESCE((v_session.client_state->>'nonce')::bigint, p_nonce),
        'revealed', v_revealed,
        'multiplier', public.mines_next_multiplier(jsonb_array_length(v_revealed), v_mine_count),
        'resumed', true
      );
    END IF;
    RAISE EXCEPTION 'MINES_SESSION_ACTIVE' USING ERRCODE = 'P0002';
  END IF;

  v_debit := public.debit_phon_for_bet_v2(p_amount, v_game, v_round);
  v_mines := public.mines_generate_layout(p_server_seed, p_client_seed, p_nonce, p_mine_count);

  v_state := jsonb_build_object(
    'nonce', p_nonce,
    'mine_count', public.mines_clamp_count(p_mine_count),
    'client_seed', trim(p_client_seed),
    'revealed', '[]'::jsonb,
    'placed_at', (extract(epoch from now()) * 1000)::bigint
  );

  INSERT INTO public.game_active_sessions (user_id, game, round_id, bet_amount, client_state, status)
  VALUES (v_uid, v_game, v_round, p_amount, v_state, 'active')
  RETURNING * INTO v_session;

  INSERT INTO public.game_session_secrets (session_id, mines) VALUES (v_session.id, v_mines);

  RETURN json_build_object(
    'debit', v_debit,
    'session_id', v_session.id,
    'round_id', v_round,
    'bet_amount', p_amount,
    'mine_count', public.mines_clamp_count(p_mine_count),
    'nonce', p_nonce,
    'revealed', '[]'::jsonb,
    'multiplier', 1.0,
    'resumed', false
  );
END;
$$;
