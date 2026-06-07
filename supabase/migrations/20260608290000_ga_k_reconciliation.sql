-- GA-K: Reconciliation — payout SSOT (micro-PHON) + shadow audit + alerts.
-- Does NOT touch live_bets triggers or autobot paths.

-- ─── micro-PHON additive column (wallet read path unchanged — phon remains SSOT W1~W3) ─

ALTER TABLE public.wallet_balances
  ADD COLUMN IF NOT EXISTS phon_micro bigint;

UPDATE public.wallet_balances
SET phon_micro = phon * 1000000
WHERE phon_micro IS NULL;

ALTER TABLE public.wallet_balances
  ALTER COLUMN phon_micro SET DEFAULT 0;

-- ─── Payout SSOT (mirrors houseEdge.ts + money.ts) ───────────────────────────

CREATE OR REPLACE FUNCTION public.compute_payout_phon(p_bet bigint, p_multiplier numeric)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_bet IS NULL OR p_bet < 0 OR p_multiplier IS NULL OR p_multiplier < 0 THEN 0::bigint
    ELSE round(p_bet::numeric * p_multiplier)::bigint
  END;
$$;

REVOKE ALL ON FUNCTION public.compute_payout_phon(bigint, numeric) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.compute_payout_micro_phon(p_bet_micro bigint, p_multiplier_e6 bigint)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_bet_micro IS NULL OR p_bet_micro < 0 OR p_multiplier_e6 IS NULL OR p_multiplier_e6 < 0 THEN 0::bigint
    ELSE round(p_bet_micro::numeric * p_multiplier_e6::numeric / 1000000.0)::bigint
  END;
$$;

REVOKE ALL ON FUNCTION public.compute_payout_micro_phon(bigint, bigint) FROM PUBLIC, anon, authenticated;

-- Integer bet + multiplier_e6 path (game_rounds GA-A column).
CREATE OR REPLACE FUNCTION public.compute_payout_from_e6(p_bet bigint, p_multiplier_e6 bigint)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_bet IS NULL OR p_bet < 0 OR p_multiplier_e6 IS NULL OR p_multiplier_e6 < 0 THEN 0::bigint
    ELSE round(p_bet::numeric * p_multiplier_e6::numeric / 1000000.0)::bigint
  END;
$$;

REVOKE ALL ON FUNCTION public.compute_payout_from_e6(bigint, bigint) FROM PUBLIC, anon, authenticated;

-- ─── reconciliation_alerts ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reconciliation_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type text NOT NULL CHECK (alert_type IN (
    'payout_mismatch', 'wallet_negative', 'wallet_integrity', 'shadow_audit'
  )),
  severity text NOT NULL DEFAULT 'warning' CHECK (severity IN ('info', 'warning', 'critical')),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  game text,
  round_id text,
  expected_value bigint,
  actual_value bigint,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS reconciliation_alerts_created_idx
  ON public.reconciliation_alerts (created_at DESC);

CREATE INDEX IF NOT EXISTS reconciliation_alerts_open_idx
  ON public.reconciliation_alerts (alert_type, created_at DESC)
  WHERE resolved_at IS NULL;

ALTER TABLE public.reconciliation_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reconciliation_alerts_admin_select ON public.reconciliation_alerts;
CREATE POLICY reconciliation_alerts_admin_select ON public.reconciliation_alerts
  FOR SELECT TO authenticated
  USING (public.assert_is_admin() = auth.uid());

REVOKE ALL ON TABLE public.reconciliation_alerts FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.reconciliation_alerts TO authenticated;

-- ─── reconciliation_runs (audit log) ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type text NOT NULL DEFAULT 'daily',
  alerts_created int NOT NULL DEFAULT 0,
  rounds_scanned int NOT NULL DEFAULT 0,
  wallets_checked int NOT NULL DEFAULT 0,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.reconciliation_runs FROM PUBLIC, anon, authenticated;

-- ─── Internal: record alert (dedupe same day) ────────────────────────────────

CREATE OR REPLACE FUNCTION public.reconciliation_record_alert_v1(
  p_alert_type text,
  p_severity text,
  p_user_id uuid,
  p_game text,
  p_round_id text,
  p_expected bigint,
  p_actual bigint,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reconciliation_alerts
    WHERE alert_type = p_alert_type
      AND coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND coalesce(game, '') = coalesce(p_game, '')
      AND coalesce(round_id, '') = coalesce(p_round_id, '')
      AND resolved_at IS NULL
      AND created_at > now() - interval '24 hours'
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.reconciliation_alerts (
    alert_type, severity, user_id, game, round_id,
    expected_value, actual_value, details
  ) VALUES (
    p_alert_type, p_severity, p_user_id, p_game, p_round_id,
    p_expected, p_actual, coalesce(p_details, '{}'::jsonb)
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reconciliation_record_alert_v1(text, text, uuid, text, text, bigint, bigint, jsonb) FROM PUBLIC, anon, authenticated;

-- ─── Shadow audit: high payouts with multiplier_e6 ───────────────────────────

CREATE OR REPLACE FUNCTION public.reconciliation_shadow_audit_v1(
  p_since timestamptz DEFAULT now() - interval '24 hours',
  p_min_payout bigint DEFAULT 1000
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.game_rounds%ROWTYPE;
  v_expected bigint;
  v_threshold bigint;
  v_count int := 0;
  v_strict boolean;
BEGIN
  SELECT coalesce(f.enabled AND f.rollout_percent >= 100, false) INTO v_strict
  FROM public.game_authority_flags f
  WHERE f.key = 'reconciliation_strict';
  v_strict := coalesce(v_strict, false);
  v_threshold := CASE WHEN v_strict THEN 1 ELSE greatest(1, coalesce(p_min_payout, 1000)) END;

  FOR v_row IN
    SELECT * FROM public.game_rounds
    WHERE created_at >= p_since
      AND payout_amount >= v_threshold
      AND multiplier_e6 IS NOT NULL
      AND multiplier_e6 > 0
  LOOP
    v_expected := public.compute_payout_from_e6(v_row.bet_amount, v_row.multiplier_e6);
    IF v_expected <> v_row.payout_amount THEN
      PERFORM public.reconciliation_record_alert_v1(
        'shadow_audit',
        CASE WHEN abs(v_expected - v_row.payout_amount) > 1 THEN 'critical' ELSE 'warning' END,
        v_row.user_id,
        v_row.game,
        v_row.round_id,
        v_expected,
        v_row.payout_amount,
        jsonb_build_object(
          'bet_amount', v_row.bet_amount,
          'multiplier_e6', v_row.multiplier_e6,
          'strict_mode', v_strict
        )
      );
      v_count := v_count + 1;
    END IF;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconciliation_shadow_audit_v1(timestamptz, bigint) FROM PUBLIC, anon, authenticated;

-- ─── Wallet integrity: negative balance guard ────────────────────────────────

CREATE OR REPLACE FUNCTION public.reconciliation_wallet_integrity_v1()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.wallet_balances%ROWTYPE;
  v_count int := 0;
BEGIN
  FOR v_row IN
    SELECT * FROM public.wallet_balances WHERE phon < 0 OR coalesce(phon_micro, 0) < 0
  LOOP
    PERFORM public.reconciliation_record_alert_v1(
      'wallet_negative',
      'critical',
      v_row.user_id,
      NULL,
      NULL,
      0,
      v_row.phon,
      jsonb_build_object('phon_micro', v_row.phon_micro)
    );
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.reconciliation_wallet_integrity_v1() FROM PUBLIC, anon, authenticated;

-- ─── Daily reconciliation (service_role / cron) ────────────────────────────

CREATE OR REPLACE FUNCTION public.reconciliation_run_daily_v1()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz := now() - interval '24 hours';
  v_shadow int;
  v_wallet int;
  v_total int;
  v_scanned int;
  v_run_id uuid;
BEGIN
  SELECT count(*)::int INTO v_scanned
  FROM public.game_rounds
  WHERE created_at >= v_since AND payout_amount > 0;

  v_shadow := public.reconciliation_shadow_audit_v1(v_since, 1000);
  v_wallet := public.reconciliation_wallet_integrity_v1();
  v_total := v_shadow + v_wallet;

  INSERT INTO public.reconciliation_runs (run_type, alerts_created, rounds_scanned, wallets_checked, details)
  VALUES (
    'daily',
    v_total,
    v_scanned,
    (SELECT count(*)::int FROM public.wallet_balances),
    jsonb_build_object('shadow_alerts', v_shadow, 'wallet_alerts', v_wallet)
  )
  RETURNING id INTO v_run_id;

  RETURN json_build_object(
    'run_id', v_run_id,
    'alerts_created', v_total,
    'shadow_alerts', v_shadow,
    'wallet_alerts', v_wallet,
    'rounds_scanned', v_scanned,
    'since', v_since
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconciliation_run_daily_v1() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconciliation_run_daily_v1() TO service_role;

-- ─── Public monthly PF audit export (rotated seeds only) ─────────────────────

CREATE OR REPLACE FUNCTION public.audit_export_month_v1(p_yyyy_mm text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month text := trim(p_yyyy_mm);
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  IF v_month !~ '^\d{4}-\d{2}$' THEN
    RAISE EXCEPTION 'AUDIT_INVALID_MONTH';
  END IF;

  v_start := (v_month || '-01')::date::timestamptz;
  v_end := v_start + interval '1 month';

  RETURN json_build_object(
    'month', v_month,
    'generated_at', now(),
    'rotated_seeds', coalesce((
      SELECT json_agg(json_build_object(
        'game', s.game,
        'server_seed_hash', s.server_seed_hash,
        'server_seed', s.server_seed,
        'rotated_at', s.rotated_at,
        'final_nonce', s.nonce
      ) ORDER BY s.rotated_at)
      FROM public.pf_sessions s
      WHERE s.status = 'rotated'
        AND s.rotated_at >= v_start
        AND s.rotated_at < v_end
    ), '[]'::json),
    'reconciliation_24h', coalesce((
      SELECT json_build_object(
        'open_alerts', count(*) FILTER (WHERE resolved_at IS NULL),
        'total_alerts', count(*)
      )
      FROM public.reconciliation_alerts
      WHERE created_at >= now() - interval '24 hours'
    ), '{}'::json)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_export_month_v1(text) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_export_month_v1(text) FROM PUBLIC;

-- ─── Probe RPC (smoke / parity) ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reconciliation_probe_v1(
  p_bet bigint,
  p_multiplier numeric,
  p_multiplier_e6 bigint DEFAULT NULL
)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'payout_phon', public.compute_payout_phon(p_bet, p_multiplier),
    'payout_micro', CASE
      WHEN p_multiplier_e6 IS NULL THEN NULL
      ELSE public.compute_payout_from_e6(p_bet, p_multiplier_e6)
    END,
    'payout_micro_exact', CASE
      WHEN p_multiplier_e6 IS NULL THEN NULL
      ELSE public.compute_payout_micro_phon(p_bet * 1000000, p_multiplier_e6)
    END
  );
$$;

GRANT EXECUTE ON FUNCTION public.reconciliation_probe_v1(bigint, numeric, bigint) TO authenticated;
REVOKE ALL ON FUNCTION public.reconciliation_probe_v1(bigint, numeric, bigint) FROM PUBLIC, anon;

-- ─── Wallet non-negative constraint ──────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'wallet_balances_phon_non_negative'
  ) THEN
    ALTER TABLE public.wallet_balances
      ADD CONSTRAINT wallet_balances_phon_non_negative CHECK (phon >= 0);
  END IF;
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'wallet_balances_phon_non_negative skipped — fix negative rows first';
END $$;

-- ─── Feature flag ────────────────────────────────────────────────────────────

INSERT INTO public.game_authority_flags (key, enabled, rollout_percent, description)
VALUES ('reconciliation_strict', true, 100, 'GA-K strict shadow audit (all payouts ≥1 PHON)')
ON CONFLICT (key) DO UPDATE SET
  enabled = EXCLUDED.enabled,
  rollout_percent = EXCLUDED.rollout_percent,
  description = EXCLUDED.description,
  updated_at = now();
