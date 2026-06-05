-- =============================================================================
-- earn-flow Money Layer — Security Upgrade (SAFE / INCREMENTAL)
-- =============================================================================
-- Strategy:
--   • v1 RPCs (debit_phon_for_bet, credit_phon_for_payout) are NOT modified.
--   • v2 RPCs add idempotency + audit + stricter validation alongside v1.
--   • Client opts in via debit_phon_for_bet_v2 / credit_phon_for_payout_v2.
--   • All statements idempotent — safe to re-run.
--
-- Audit SSOT: game_rounds (bet_amount / payout_amount per round).
-- Idempotency cache: money_idempotency_ledger (replay only, not full audit_logs).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Supporting objects (additive only)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.money_idempotency_ledger (
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  operation       text        NOT NULL CHECK (operation IN (
                    'debit_phon_for_bet_v2',
                    'credit_phon_for_payout_v2'
                  )),
  idempotency_key text        NOT NULL,
  amount          bigint      NOT NULL CHECK (amount > 0),
  response        jsonb       NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation, idempotency_key)
);

COMMENT ON TABLE public.money_idempotency_ledger IS
  'Idempotency replay cache for v2 money RPCs. Populated only by SECURITY DEFINER functions.';

CREATE INDEX IF NOT EXISTS idx_money_idempotency_user_created
  ON public.money_idempotency_ledger (user_id, created_at DESC);

-- game_rounds may pre-exist from 20260605200000; index is additive
CREATE INDEX IF NOT EXISTS idx_game_rounds_user_created
  ON public.game_rounds (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_trading_positions_user_id
  ON public.trading_positions (user_id);

-- Shared validator (new object — does not alter v1 behaviour)
CREATE OR REPLACE FUNCTION public.money_validate_bet_input(
  p_amount bigint,
  p_game text,
  p_round_id text
)
RETURNS void
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'MONEY_INVALID_AMOUNT'
      USING ERRCODE = '22023', HINT = 'amount must be positive integer';
  END IF;
  IF p_game IS NULL OR length(trim(p_game)) = 0 OR length(p_game) > 32 THEN
    RAISE EXCEPTION 'MONEY_INVALID_GAME'
      USING ERRCODE = '22023', HINT = 'game length 1..32';
  END IF;
  IF p_round_id IS NULL OR length(trim(p_round_id)) = 0 OR length(p_round_id) > 128 THEN
    RAISE EXCEPTION 'MONEY_INVALID_ROUND_ID'
      USING ERRCODE = '22023', HINT = 'round_id length 1..128';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.money_validate_bet_input(bigint, text, text) TO authenticated;
