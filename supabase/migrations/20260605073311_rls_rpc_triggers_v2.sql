-- RLS, signup triggers, onboarding RPC for phonara-gb (kanftnqenuzverroodev)

-- Referral code generator
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
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

-- Signup: create profile + wallet row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, referral_code)
  VALUES (NEW.id, public.generate_referral_code());
  INSERT INTO public.wallet_balances (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Onboarding step RPC
DROP FUNCTION IF EXISTS public.complete_onboarding_step(integer, text);
CREATE OR REPLACE FUNCTION public.complete_onboarding_step(
  p_step_index integer,
  p_nickname text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  prof public.profiles%ROWTYPE;
  wal public.wallet_balances%ROWTYPE;
  reward bigint := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_step_index < 0 OR p_step_index > 4 THEN
    RAISE EXCEPTION 'invalid step index';
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile not found';
  END IF;

  IF p_step_index > prof.onboarding_step THEN
    reward := CASE p_step_index
      WHEN 1 THEN 50000
      WHEN 2 THEN 100000
      WHEN 3 THEN 200000
      WHEN 4 THEN 500000
      ELSE 0
    END;

    UPDATE public.profiles
    SET
      onboarding_step = p_step_index,
      onboarding_completed = (p_step_index >= 4),
      nickname = COALESCE(p_nickname, nickname),
      updated_at = now()
    WHERE id = uid
    RETURNING * INTO prof;

    IF reward > 0 THEN
      UPDATE public.wallet_balances
      SET phon = phon + reward, updated_at = now()
      WHERE user_id = uid
      RETURNING * INTO wal;
    ELSE
      SELECT * INTO wal FROM public.wallet_balances WHERE user_id = uid;
    END IF;
  ELSE
    IF p_nickname IS NOT NULL THEN
      UPDATE public.profiles SET nickname = p_nickname, updated_at = now() WHERE id = uid RETURNING * INTO prof;
    END IF;
    SELECT * INTO wal FROM public.wallet_balances WHERE user_id = uid;
  END IF;

  RETURN json_build_object(
    'reward', reward,
    'profile', row_to_json(prof),
    'balance', row_to_json(wal)
  );
END;
$$;

-- Debit PHON for real-mode bets (stub — credit/settlement server-side later)
CREATE OR REPLACE FUNCTION public.debit_phon_for_bet(
  p_amount bigint,
  p_game text,
  p_round_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  wal public.wallet_balances%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;

  UPDATE public.wallet_balances
  SET phon = phon - p_amount, updated_at = now()
  WHERE user_id = uid AND phon >= p_amount
  RETURNING * INTO wal;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient balance';
  END IF;

  RETURN json_build_object('balance', row_to_json(wal), 'game', p_game, 'round_id', p_round_id);
END;
$$;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS wallet_select_own ON public.wallet_balances;
CREATE POLICY wallet_select_own ON public.wallet_balances
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No client UPDATE on wallet_balances — money via RPC only
REVOKE UPDATE ON public.wallet_balances FROM authenticated, anon;

GRANT EXECUTE ON FUNCTION public.complete_onboarding_step(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.debit_phon_for_bet(bigint, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_referral_code() TO authenticated, anon;
