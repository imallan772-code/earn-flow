-- =============================================================================
-- Part 4: SET search_path on remaining mutable helpers (advisor lint 0011)
-- Body unchanged — search_path only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  code text;
BEGIN
  LOOP
    code := 'PHO-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code);
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION public.mission_period_key(p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_kind = 'daily' THEN to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')
              ELSE 'all' END;
$$;

-- PF / Mines helpers (body unchanged — search_path only)
ALTER FUNCTION public.pf_hmac_bytes(text, text, bigint, int) SET search_path = public, extensions;
ALTER FUNCTION public.pf_float_from_bytes(bytea, int) SET search_path = public;
ALTER FUNCTION public.pf_draw_float(text, text, bigint, int) SET search_path = public, extensions;
ALTER FUNCTION public.mines_clamp_count(int) SET search_path = public;
ALTER FUNCTION public.mines_generate_layout(text, text, bigint, int) SET search_path = public, extensions;
ALTER FUNCTION public.mines_next_multiplier(int, int) SET search_path = public;
ALTER FUNCTION public.live_bet_mask_display(uuid) SET search_path = public;
ALTER FUNCTION public.sync_live_bet_from_game_round() SET search_path = public;
