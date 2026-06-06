-- =============================================================================
-- Stake-like resume: server-authoritative active sessions (real mode SSOT)
-- Mines: mine layout in game_session_secrets (never client-readable)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.game_active_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game          text NOT NULL,
  round_id      text NOT NULL,
  bet_amount    bigint NOT NULL DEFAULT 0 CHECK (bet_amount >= 0),
  client_state  jsonb NOT NULL DEFAULT '{}',
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'settled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game)
);

CREATE TABLE IF NOT EXISTS public.game_session_secrets (
  session_id uuid PRIMARY KEY REFERENCES public.game_active_sessions(id) ON DELETE CASCADE,
  mines      int[] NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_active_sessions_user_game
  ON public.game_active_sessions (user_id, game) WHERE status = 'active';

ALTER TABLE public.game_active_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_session_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_active_sessions_select_own ON public.game_active_sessions;
CREATE POLICY game_active_sessions_select_own ON public.game_active_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON public.game_active_sessions FROM authenticated, anon;
REVOKE ALL ON public.game_session_secrets FROM authenticated, anon;
GRANT SELECT ON public.game_active_sessions TO authenticated;

-- ─── PF helpers (Stake HMAC-SHA256 scheme) ───────────────────────────────────

CREATE OR REPLACE FUNCTION public.pf_hmac_bytes(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint,
  p_cursor int
)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extensions.hmac(
    convert_to(trim(p_client_seed) || ':' || p_nonce::text || ':' || p_cursor::text, 'UTF8'),
    convert_to(trim(p_server_seed), 'UTF8'),
    'sha256'
  );
$$;

CREATE OR REPLACE FUNCTION public.pf_float_from_bytes(p_bytes bytea, p_offset int)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  b0 int; b1 int; b2 int; b3 int;
BEGIN
  IF length(p_bytes) < p_offset + 4 THEN
    RAISE EXCEPTION 'PF_BYTES_TOO_SHORT';
  END IF;
  b0 := get_byte(p_bytes, p_offset);
  b1 := get_byte(p_bytes, p_offset + 1);
  b2 := get_byte(p_bytes, p_offset + 2);
  b3 := get_byte(p_bytes, p_offset + 3);
  RETURN (b0 / 256.0) + (b1 / 65536.0) + (b2 / 16777216.0) + (b3 / 4294967296.0);
END;
$$;

CREATE OR REPLACE FUNCTION public.pf_draw_float(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint,
  p_index int
)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_cursor int;
  v_offset int;
  v_bytes bytea;
BEGIN
  v_cursor := p_index / 8;
  v_offset := (p_index % 8) * 4;
  v_bytes := public.pf_hmac_bytes(p_server_seed, p_client_seed, p_nonce, v_cursor);
  RETURN public.pf_float_from_bytes(v_bytes, v_offset);
END;
$$;

CREATE OR REPLACE FUNCTION public.mines_clamp_count(p_mine_count int)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(1, LEAST(24, COALESCE(p_mine_count, 1)));
$$;

CREATE OR REPLACE FUNCTION public.mines_generate_layout(
  p_server_seed text,
  p_client_seed text,
  p_nonce bigint,
  p_mine_count int
)
RETURNS int[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  tiles int[] := ARRAY(SELECT generate_series(0, 24));
  m int := public.mines_clamp_count(p_mine_count);
  i_js int;
  j_js int;
  tmp int;
BEGIN
  FOR i_js IN REVERSE 24..1 LOOP
    j_js := floor(public.pf_draw_float(p_server_seed, p_client_seed, p_nonce, 24 - i_js) * (i_js + 1))::int;
    j_js := GREATEST(0, LEAST(i_js, j_js));
    tmp := tiles[i_js + 1];
    tiles[i_js + 1] := tiles[j_js + 1];
    tiles[j_js + 1] := tmp;
  END LOOP;
  RETURN (SELECT array_agg(x ORDER BY x) FROM unnest(tiles[1:m]) AS x);
END;
$$;

CREATE OR REPLACE FUNCTION public.mines_next_multiplier(p_revealed int, p_mine_count int)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  m int;
  r int;
  mult double precision := 0.99;
  i int;
BEGIN
  IF p_revealed <= 0 THEN RETURN 1.0; END IF;
  m := public.mines_clamp_count(p_mine_count);
  r := GREATEST(0, LEAST(25 - m, p_revealed));
  FOR i IN 0..(r - 1) LOOP
    mult := mult * ((25.0 - i) / (25.0 - m - i));
  END LOOP;
  RETURN mult;
END;
$$;

-- ─── Generic session RPCs (Crash / Limbo / Wheel resume) ─────────────────────

CREATE OR REPLACE FUNCTION public.get_game_active_session_v1(p_game text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := trim(p_game);
  v_row public.game_active_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF v_game IS NULL OR length(v_game) = 0 THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;

  SELECT * INTO v_row FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND status = 'active';

  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN json_build_object(
    'session_id', v_row.id,
    'game', v_row.game,
    'round_id', v_row.round_id,
    'bet_amount', v_row.bet_amount,
    'client_state', v_row.client_state,
    'status', v_row.status,
    'updated_at', v_row.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_game_active_session_v1(
  p_game text,
  p_round_id text,
  p_bet_amount bigint,
  p_client_state jsonb
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := trim(p_game);
  v_round text := trim(p_round_id);
  v_row public.game_active_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.money_validate_bet_input(p_bet_amount, v_game, v_round);

  INSERT INTO public.game_active_sessions (user_id, game, round_id, bet_amount, client_state, status, updated_at)
  VALUES (v_uid, v_game, v_round, p_bet_amount, COALESCE(p_client_state, '{}'::jsonb), 'active', now())
  ON CONFLICT (user_id, game) DO UPDATE SET
    round_id = EXCLUDED.round_id,
    bet_amount = EXCLUDED.bet_amount,
    client_state = EXCLUDED.client_state,
    status = 'active',
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'session_id', v_row.id,
    'game', v_row.game,
    'round_id', v_row.round_id,
    'bet_amount', v_row.bet_amount,
    'client_state', v_row.client_state,
    'status', v_row.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_game_active_session_v1(p_game text, p_round_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := trim(p_game);
  v_round text := trim(p_round_id);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  UPDATE public.game_active_sessions
  SET status = 'settled', updated_at = now()
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active';

  RETURN FOUND;
END;
$$;

-- ─── Mines authoritative RPCs ────────────────────────────────────────────────

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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  PERFORM public.money_validate_bet_input(p_amount, v_game, v_round);

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND game = v_game AND status = 'active'
  ) THEN
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
    'revealed', '[]'::json,
    'multiplier', 1.0
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mines_reveal_tile_v1(p_round_id text, p_tile int)
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
  v_mines int[];
  v_revealed jsonb;
  v_revealed_arr int[];
  v_mine_count int;
  v_is_mine boolean;
  v_mult double precision;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF p_tile < 0 OR p_tile > 24 THEN RAISE EXCEPTION 'INVALID_TILE'; END IF;

  SELECT s.* INTO v_session FROM public.game_active_sessions s
  WHERE s.user_id = v_uid AND s.game = v_game AND s.round_id = v_round AND s.status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'MINES_SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  SELECT sec.mines INTO v_mines FROM public.game_session_secrets sec WHERE sec.session_id = v_session.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'MINES_SECRET_NOT_FOUND'; END IF;

  v_revealed := COALESCE(v_session.client_state->'revealed', '[]'::jsonb);
  IF v_revealed @> to_jsonb(p_tile) THEN RAISE EXCEPTION 'TILE_ALREADY_REVEALED'; END IF;

  v_mine_count := (v_session.client_state->>'mine_count')::int;
  v_is_mine := p_tile = ANY (v_mines);

  IF v_is_mine THEN
    UPDATE public.game_active_sessions SET status = 'settled', updated_at = now() WHERE id = v_session.id;
    RETURN json_build_object(
      'hit', true,
      'tile', p_tile,
      'mines', to_json(v_mines),
      'revealed', v_revealed,
      'multiplier', public.mines_next_multiplier(jsonb_array_length(v_revealed), v_mine_count),
      'round_id', v_round
    );
  END IF;

  v_revealed := v_revealed || to_jsonb(p_tile);
  UPDATE public.game_active_sessions
  SET client_state = jsonb_set(client_state, '{revealed}', v_revealed), updated_at = now()
  WHERE id = v_session.id;

  v_mult := public.mines_next_multiplier(jsonb_array_length(v_revealed), v_mine_count);

  RETURN json_build_object(
    'hit', false,
    'tile', p_tile,
    'revealed', v_revealed,
    'multiplier', v_mult,
    'next_multiplier', public.mines_next_multiplier(jsonb_array_length(v_revealed) + 1, v_mine_count),
    'round_id', v_round
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mines_cashout_v1(p_round_id text, p_gross_payout bigint)
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
  v_credit json;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'MONEY_AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  SELECT * INTO v_session FROM public.game_active_sessions
  WHERE user_id = v_uid AND game = v_game AND round_id = v_round AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'MINES_SESSION_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;

  v_revealed := COALESCE(v_session.client_state->'revealed', '[]'::jsonb);
  IF jsonb_array_length(v_revealed) < 1 THEN RAISE EXCEPTION 'MINES_CASHOUT_NO_REVEALS'; END IF;

  v_credit := public.credit_phon_for_payout_v2(p_gross_payout, v_game, v_round);

  UPDATE public.game_active_sessions SET status = 'settled', updated_at = now() WHERE id = v_session.id;

  RETURN json_build_object(
    'credit', v_credit,
    'round_id', v_round,
    'gross_payout', p_gross_payout,
    'revealed', v_revealed
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_game_active_session_v1(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_game_active_session_v1(text, text, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_game_active_session_v1(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mines_start_round_v1(bigint, text, int, text, bigint, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mines_reveal_tile_v1(text, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mines_cashout_v1(text, bigint) TO authenticated;

REVOKE ALL ON FUNCTION public.pf_hmac_bytes(text, text, bigint, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pf_float_from_bytes(bytea, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pf_draw_float(text, text, bigint, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mines_clamp_count(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mines_generate_layout(text, text, bigint, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mines_next_multiplier(int, int) FROM PUBLIC, anon, authenticated;
