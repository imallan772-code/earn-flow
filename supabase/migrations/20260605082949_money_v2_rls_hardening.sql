-- -----------------------------------------------------------------------------
-- C. RLS hardening (strengthen existing policies — idempotent)
-- -----------------------------------------------------------------------------
-- Uses (SELECT auth.uid()) for per-statement eval (Supabase perf recommendation).
-- REVOKE direct writes: money mutations only via SECURITY DEFINER RPCs.
-- (No FORCE RLS — avoids breaking SECURITY DEFINER signup trigger / service paths.)

-- wallet_balances (existing: wallet_select_own from initial_schema)
ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wallet_select_own ON public.wallet_balances;
CREATE POLICY wallet_select_own ON public.wallet_balances
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.wallet_balances FROM authenticated, anon;
GRANT SELECT ON public.wallet_balances TO authenticated;

-- game_rounds (existing: game_rounds_select_own from 20260605200000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'game_rounds'
  ) THEN
    EXECUTE 'ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS game_rounds_select_own ON public.game_rounds';
    EXECUTE $p$
      CREATE POLICY game_rounds_select_own ON public.game_rounds
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.game_rounds FROM authenticated, anon';
    EXECUTE 'GRANT SELECT ON public.game_rounds TO authenticated';
  END IF;
END $$;

-- trading_positions (from 20260605200000)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trading_positions'
  ) THEN
    EXECUTE 'ALTER TABLE public.trading_positions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS trading_positions_select_own ON public.trading_positions';
    EXECUTE $p$
      CREATE POLICY trading_positions_select_own ON public.trading_positions
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.trading_positions FROM authenticated, anon';
    EXECUTE 'GRANT SELECT ON public.trading_positions TO authenticated';
  END IF;
END $$;

-- trading_orders (consistency)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'trading_orders'
  ) THEN
    EXECUTE 'ALTER TABLE public.trading_orders ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS trading_orders_select_own ON public.trading_orders';
    EXECUTE $p$
      CREATE POLICY trading_orders_select_own ON public.trading_orders
        FOR SELECT TO authenticated
        USING (user_id = (SELECT auth.uid()))
    $p$;
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON public.trading_orders FROM authenticated, anon';
    EXECUTE 'GRANT SELECT ON public.trading_orders TO authenticated';
  END IF;
END $$;

-- money_idempotency_ledger (new)
ALTER TABLE public.money_idempotency_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS money_idempotency_select_own ON public.money_idempotency_ledger;
CREATE POLICY money_idempotency_select_own ON public.money_idempotency_ledger
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE INSERT, UPDATE, DELETE ON public.money_idempotency_ledger FROM authenticated, anon;
GRANT SELECT ON public.money_idempotency_ledger TO authenticated;
