-- GA-A: pf_sessions (commit/reveal rotate) + user_settings (mode/region/opt-in limits)
-- Forward-only, idempotent. Does NOT touch live_bets / autobot paths.

-- ─── Helpers ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pf_server_seed_hash(p_server_seed text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT encode(
    extensions.digest(convert_to(trim(p_server_seed), 'UTF8'), 'sha256'),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_is_anonymous()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((auth.jwt()->>'is_anonymous')::boolean, false);
$$;

CREATE OR REPLACE FUNCTION public.pf_generate_server_seed()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT encode(extensions.gen_random_bytes(32), 'hex');
$$;

-- ─── pf_sessions ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pf_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game text NOT NULL,
  server_seed text NOT NULL,
  server_seed_hash text NOT NULL,
  client_seed text NOT NULL DEFAULT '',
  nonce bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'rotated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  rotated_at timestamptz,
  CONSTRAINT pf_sessions_game_len CHECK (char_length(trim(game)) BETWEEN 1 AND 32),
  CONSTRAINT pf_sessions_server_seed_len CHECK (char_length(trim(server_seed)) BETWEEN 8 AND 128),
  CONSTRAINT pf_sessions_client_seed_len CHECK (char_length(client_seed) <= 64)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pf_sessions_user_game_active
  ON public.pf_sessions (user_id, game)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_pf_sessions_user_game_created
  ON public.pf_sessions (user_id, game, created_at DESC);

ALTER TABLE public.pf_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pf_sessions_select_own ON public.pf_sessions;
CREATE POLICY pf_sessions_select_own ON public.pf_sessions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.pf_sessions FROM authenticated, anon;
GRANT SELECT ON public.pf_sessions TO authenticated;

-- ─── user_settings (Region-Aware + opt-in loss limits — no forced defaults) ───

CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_mode text NOT NULL DEFAULT 'real' CHECK (preferred_mode IN ('demo', 'real')),
  safety_tier text NOT NULL DEFAULT 'tier_0_new'
    CHECK (safety_tier IN ('tier_0_new', 'tier_1_regular', 'tier_2_vip')),
  region text NOT NULL DEFAULT 'region_global'
    CHECK (region IN ('region_kr', 'region_global', 'region_restricted')),
  daily_loss_limit_phon bigint CHECK (daily_loss_limit_phon IS NULL OR daily_loss_limit_phon > 0),
  daily_loss_limit_pct int CHECK (daily_loss_limit_pct IS NULL OR (daily_loss_limit_pct BETWEEN 1 AND 99)),
  max_consecutive_losses int CHECK (max_consecutive_losses IS NULL OR (max_consecutive_losses BETWEEN 1 AND 100)),
  daily_round_limit int NOT NULL DEFAULT 10000 CHECK (daily_round_limit BETWEEN 1 AND 50000),
  auto_bet_consent_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_select_own ON public.user_settings;
CREATE POLICY user_settings_select_own ON public.user_settings
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.user_settings FROM authenticated, anon;
GRANT SELECT ON public.user_settings TO authenticated;

-- ─── game_rounds audit columns (GA-A additive) ─────────────────────────────────

ALTER TABLE public.game_rounds
  ADD COLUMN IF NOT EXISTS pf_session_id uuid REFERENCES public.pf_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bet_params jsonb,
  ADD COLUMN IF NOT EXISTS bet_mode text CHECK (bet_mode IS NULL OR bet_mode IN ('demo', 'real')),
  ADD COLUMN IF NOT EXISTS multiplier_e6 bigint;

-- ─── Internal: ensure user_settings row ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ensure_user_settings_v1(p_user_id uuid)
RETURNS public.user_settings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.user_settings%ROWTYPE;
BEGIN
  INSERT INTO public.user_settings (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_row FROM public.user_settings WHERE user_id = p_user_id;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_settings_v1(uuid) FROM PUBLIC, anon, authenticated;

-- ─── resolve_user_mode_v1 (server SSOT — anon always demo) ────────────────────

CREATE OR REPLACE FUNCTION public.resolve_user_mode_v1()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_mode text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000';
  END IF;

  IF public.auth_is_anonymous() THEN
    RETURN 'demo';
  END IF;

  SELECT preferred_mode INTO v_mode
  FROM public.user_settings
  WHERE user_id = v_uid;

  IF v_mode IS NULL THEN
    RETURN 'real';
  END IF;

  RETURN v_mode;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_user_mode_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.resolve_user_mode_v1() FROM PUBLIC, anon;

-- ─── user_get_settings_v1 ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.user_get_settings_v1()
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.user_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  v_row := public.ensure_user_settings_v1(v_uid);
  RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_get_settings_v1() TO authenticated;
REVOKE ALL ON FUNCTION public.user_get_settings_v1() FROM PUBLIC, anon;

-- ─── user_set_preferred_mode_v1 ──────────────────────────────────────────────

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

-- ─── pf_session_create_or_get_v1 ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pf_session_create_or_get_v1(
  p_game text,
  p_client_seed text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := lower(trim(p_game));
  v_row public.pf_sessions%ROWTYPE;
  v_seed text;
  v_client text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  IF char_length(v_game) < 1 OR char_length(v_game) > 32 THEN RAISE EXCEPTION 'INVALID_GAME'; END IF;

  PERFORM public.ensure_user_settings_v1(v_uid);

  SELECT * INTO v_row
  FROM public.pf_sessions
  WHERE user_id = v_uid AND game = v_game AND status = 'active'
  FOR UPDATE;

  IF FOUND THEN
    IF p_client_seed IS NOT NULL AND trim(p_client_seed) <> '' AND trim(p_client_seed) <> v_row.client_seed THEN
      IF EXISTS (
        SELECT 1 FROM public.game_active_sessions
        WHERE user_id = v_uid AND game = v_game AND status = 'active'
      ) THEN
        RAISE EXCEPTION 'PF_ACTIVE_ROUND' USING ERRCODE = '42501';
      END IF;

      v_client := left(trim(p_client_seed), 64);
      UPDATE public.pf_sessions
      SET client_seed = v_client, nonce = 0
      WHERE id = v_row.id
      RETURNING * INTO v_row;
    END IF;

    RETURN json_build_object(
      'id', v_row.id,
      'game', v_row.game,
      'server_seed', v_row.server_seed,
      'server_seed_hash', v_row.server_seed_hash,
      'client_seed', v_row.client_seed,
      'nonce', v_row.nonce,
      'status', v_row.status
    );
  END IF;

  v_seed := public.pf_generate_server_seed();
  v_client := COALESCE(NULLIF(left(trim(p_client_seed), 64), ''), 'phonara-player-001');

  INSERT INTO public.pf_sessions (
    user_id, game, server_seed, server_seed_hash, client_seed, nonce, status
  ) VALUES (
    v_uid,
    v_game,
    v_seed,
    public.pf_server_seed_hash(v_seed),
    v_client,
    0,
    'active'
  )
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'game', v_row.game,
    'server_seed', v_row.server_seed,
    'server_seed_hash', v_row.server_seed_hash,
    'client_seed', v_row.client_seed,
    'nonce', v_row.nonce,
    'status', v_row.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pf_session_create_or_get_v1(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.pf_session_create_or_get_v1(text, text) FROM PUBLIC, anon;

-- ─── pf_session_set_client_seed_v1 ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pf_session_set_client_seed_v1(
  p_game text,
  p_client_seed text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := lower(trim(p_game));
  v_row public.pf_sessions%ROWTYPE;
  v_client text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;
  v_client := left(trim(p_client_seed), 64);
  IF v_client = '' THEN RAISE EXCEPTION 'INVALID_CLIENT_SEED'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND game = v_game AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'PF_ACTIVE_ROUND' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row
  FROM public.pf_sessions
  WHERE user_id = v_uid AND game = v_game AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.pf_session_create_or_get_v1(v_game, v_client);
  END IF;

  UPDATE public.pf_sessions
  SET client_seed = v_client, nonce = 0
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'game', v_row.game,
    'server_seed', v_row.server_seed,
    'server_seed_hash', v_row.server_seed_hash,
    'client_seed', v_row.client_seed,
    'nonce', v_row.nonce,
    'status', v_row.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pf_session_set_client_seed_v1(text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.pf_session_set_client_seed_v1(text, text) FROM PUBLIC, anon;

-- ─── pf_session_rotate_v1 ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.pf_session_rotate_v1(p_game text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_game text := lower(trim(p_game));
  v_old public.pf_sessions%ROWTYPE;
  v_new public.pf_sessions%ROWTYPE;
  v_seed text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE = '28000'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.game_active_sessions
    WHERE user_id = v_uid AND game = v_game AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'PF_ACTIVE_ROUND' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_old
  FROM public.pf_sessions
  WHERE user_id = v_uid AND game = v_game AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'previous', NULL,
      'current', public.pf_session_create_or_get_v1(v_game, NULL)
    );
  END IF;

  UPDATE public.pf_sessions
  SET status = 'rotated', rotated_at = now()
  WHERE id = v_old.id;

  v_seed := public.pf_generate_server_seed();

  INSERT INTO public.pf_sessions (
    user_id, game, server_seed, server_seed_hash, client_seed, nonce, status
  ) VALUES (
    v_uid,
    v_game,
    v_seed,
    public.pf_server_seed_hash(v_seed),
    v_old.client_seed,
    0,
    'active'
  )
  RETURNING * INTO v_new;

  RETURN json_build_object(
    'previous', json_build_object(
      'id', v_old.id,
      'server_seed', v_old.server_seed,
      'server_seed_hash', v_old.server_seed_hash,
      'nonce', v_old.nonce
    ),
    'current', json_build_object(
      'id', v_new.id,
      'game', v_new.game,
      'server_seed', v_new.server_seed,
      'server_seed_hash', v_new.server_seed_hash,
      'client_seed', v_new.client_seed,
      'nonce', v_new.nonce,
      'status', v_new.status
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.pf_session_rotate_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.pf_session_rotate_v1(text) FROM PUBLIC, anon;

-- ─── Harden helper functions ─────────────────────────────────────────────────

ALTER FUNCTION public.pf_server_seed_hash(text) SET search_path = public, extensions;
ALTER FUNCTION public.auth_is_anonymous() SET search_path = public;
ALTER FUNCTION public.pf_generate_server_seed() SET search_path = public, extensions;

REVOKE ALL ON FUNCTION public.pf_server_seed_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pf_generate_server_seed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auth_is_anonymous() FROM PUBLIC, anon, authenticated;
