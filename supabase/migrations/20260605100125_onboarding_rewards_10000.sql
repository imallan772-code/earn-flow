-- Onboarding rewards: 5,000 + 2,500 + 1,500 + 1,000 = 10,000 PHON total

DROP FUNCTION IF EXISTS public.complete_onboarding_step(integer, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding_step(
  p_step_index integer,
  p_nickname text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  rewards integer[] := ARRAY[5000, 2500, 1500, 1000];
  reward integer;
  prof public.profiles%ROWTYPE;
  bal public.wallet_balances%ROWTYPE;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_step_index < 0 OR p_step_index > 3 THEN
    RAISE EXCEPTION 'invalid_step';
  END IF;

  SELECT * INTO prof FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  IF prof.onboarding_completed THEN
    RAISE EXCEPTION 'onboarding_already_completed';
  END IF;

  IF prof.onboarding_step <> p_step_index THEN
    RAISE EXCEPTION 'invalid_step_order';
  END IF;

  reward := rewards[p_step_index + 1];

  IF p_step_index = 1 THEN
    IF p_nickname IS NULL OR length(trim(p_nickname)) < 2 THEN
      RAISE EXCEPTION 'nickname_required';
    END IF;
    UPDATE public.profiles
    SET nickname = trim(p_nickname),
        onboarding_step = p_step_index + 1,
        onboarding_completed = (p_step_index + 1 >= 4),
        updated_at = now()
    WHERE id = uid
    RETURNING * INTO prof;
  ELSE
    UPDATE public.profiles
    SET onboarding_step = p_step_index + 1,
        onboarding_completed = (p_step_index + 1 >= 4),
        streak_days = CASE WHEN p_step_index = 3 THEN GREATEST(streak_days, 1) ELSE streak_days END,
        updated_at = now()
    WHERE id = uid
    RETURNING * INTO prof;
  END IF;

  UPDATE public.wallet_balances
  SET phon = phon + reward,
      updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO bal;

  RETURN jsonb_build_object(
    'reward', reward,
    'profile', row_to_json(prof),
    'balance', row_to_json(bal)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_onboarding_step(integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding_step(integer, text) TO authenticated;
