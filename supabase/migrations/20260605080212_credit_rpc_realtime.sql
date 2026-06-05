-- Credit payout RPC + Realtime publication for wallet_balances

DROP FUNCTION IF EXISTS public.credit_phon_for_payout(bigint, text, text);

CREATE OR REPLACE FUNCTION public.credit_phon_for_payout(
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
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'invalid amount'; END IF;

  UPDATE public.wallet_balances
  SET phon = phon + p_amount, updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO wal;

  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;

  RETURN json_build_object('balance', row_to_json(wal), 'game', p_game, 'round_id', p_round_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.credit_phon_for_payout(bigint, text, text) TO authenticated;

-- Realtime: wallet balance updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.wallet_balances;
