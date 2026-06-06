-- =============================================================================
-- Part 2: Deprecate money v1 RPCs — client SSOT is v2 only (wallet.ts)
-- Functions remain for audit/rollback; all roles lose EXECUTE.
-- =============================================================================

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.debit_phon_for_bet(bigint,text,text)'::regprocedure,
    'public.credit_phon_for_payout(bigint,text,text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

COMMENT ON FUNCTION public.debit_phon_for_bet(bigint, text, text) IS
  'DEPRECATED — use debit_phon_for_bet_v2. EXECUTE revoked.';
COMMENT ON FUNCTION public.credit_phon_for_payout(bigint, text, text) IS
  'DEPRECATED — use credit_phon_for_payout_v2. EXECUTE revoked.';
