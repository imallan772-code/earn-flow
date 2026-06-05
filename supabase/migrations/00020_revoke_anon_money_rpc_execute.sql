-- =============================================================================
-- Money RPC — revoke anonymous execute (Supabase security advisor lint 0028)
-- =============================================================================
-- Postgres grants EXECUTE to PUBLIC by default. Explicit REVOKE closes the
-- /rest/v1/rpc/* surface for unauthenticated callers on money paths only.
-- authenticated GRANT is preserved (re-applied for idempotency).
-- =============================================================================

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.debit_phon_for_bet(bigint,text,text)'::regprocedure,
    'public.credit_phon_for_payout(bigint,text,text)'::regprocedure,
    'public.debit_phon_for_bet_v2(bigint,text,text)'::regprocedure,
    'public.credit_phon_for_payout_v2(bigint,text,text)'::regprocedure,
    'public.log_game_round(text,text,bigint,bigint)'::regprocedure,
    'public.money_validate_bet_input(bigint,text,text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
