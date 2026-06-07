-- GA-E optional: game authority feature flags (kill switch + rollout %).

CREATE TABLE IF NOT EXISTS public.game_authority_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  rollout_percent int NOT NULL DEFAULT 0 CHECK (rollout_percent >= 0 AND rollout_percent <= 100),
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_authority_flags ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.game_authority_flags FROM PUBLIC, anon, authenticated;

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES
  ('pf_session_v1_enabled', true, 100, 'GA-A PF sessions — kill switch'),
  ('crash_server_settle', true, 100, 'GA-E Crash server authority (verified → 100%)'),
  ('kill_switch', false, 0, 'Block all new bets'),
  ('read_only_resume', true, 100, 'Allow active round resume when kill_switch on')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percent = EXCLUDED.rollout_percent,
  description = EXCLUDED.description,
  updated_at = now();

-- Deterministic per-user rollout bucket (stable across sessions).
CREATE OR REPLACE FUNCTION public.game_authority_flag_v1(p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.game_authority_flags%ROWTYPE;
  v_bucket int;
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT * INTO v_row FROM public.game_authority_flags WHERE key = trim(p_key);
  IF NOT FOUND OR NOT v_row.enabled THEN
    RETURN false;
  END IF;

  IF v_row.rollout_percent >= 100 THEN
    RETURN true;
  END IF;

  IF v_row.rollout_percent <= 0 THEN
    RETURN false;
  END IF;

  v_bucket := abs(hashtext(v_uid::text || ':' || v_row.key)) % 100;
  RETURN v_bucket < v_row.rollout_percent;
END;
$$;

GRANT EXECUTE ON FUNCTION public.game_authority_flag_v1(text) TO authenticated;
REVOKE ALL ON FUNCTION public.game_authority_flag_v1(text) FROM PUBLIC, anon;

-- Admin toggle (phonara-gb admin_users).
CREATE OR REPLACE FUNCTION public.admin_set_game_authority_flag_v1(
  p_key text,
  p_enabled boolean,
  p_rollout_percent int DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_authority_flags%ROWTYPE;
BEGIN
  PERFORM public.assert_is_admin();

  IF p_rollout_percent IS NOT NULL AND (p_rollout_percent < 0 OR p_rollout_percent > 100) THEN
    RAISE EXCEPTION 'INVALID_ROLLOUT_PERCENT';
  END IF;

  UPDATE public.game_authority_flags
  SET
    enabled = p_enabled,
    rollout_percent = COALESCE(p_rollout_percent, rollout_percent),
    updated_at = now()
  WHERE key = trim(p_key)
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'FLAG_NOT_FOUND';
  END IF;

  RETURN row_to_json(v_row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_game_authority_flag_v1(text, boolean, int) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_set_game_authority_flag_v1(text, boolean, int) FROM PUBLIC, anon;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.game_authority_flag_v1(text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
