-- GA-M-ops: L3 withdrawal freeze + 4h escalation + daily metric alarm.
-- Plan: withdrawal block in L3, escalation tracking, daily health summary.

-- ─── withdrawal_freeze_check_v1 ─────────────────────────────────────────────
-- Called before withdrawal RPCs to block withdrawals during L3.

CREATE OR REPLACE FUNCTION public.withdrawal_freeze_check_v1()
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ks boolean;
  v_ro boolean;
BEGIN
  SELECT enabled INTO v_ks FROM public.game_authority_flags WHERE key = 'kill_switch';
  SELECT enabled INTO v_ro FROM public.game_authority_flags WHERE key = 'read_only_resume';

  IF COALESCE(v_ks, false) AND NOT COALESCE(v_ro, true) THEN
    RAISE EXCEPTION 'WITHDRAWAL_FROZEN_L3'
      USING ERRCODE = '42501',
            HINT = 'System is in L3 maintenance mode. Withdrawals are temporarily frozen.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.withdrawal_freeze_check_v1() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.withdrawal_freeze_check_v1() TO authenticated;

-- ─── degrade_escalation_log ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.degrade_escalation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL CHECK (level IN ('L2', 'L3')),
  duration_hours numeric NOT NULL,
  entered_at timestamptz NOT NULL,
  escalated_at timestamptz NOT NULL DEFAULT now(),
  action_taken text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.degrade_escalation_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.degrade_escalation_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.degrade_escalation_log TO authenticated;

DROP POLICY IF EXISTS degrade_escalation_admin_select ON public.degrade_escalation_log;
CREATE POLICY degrade_escalation_admin_select ON public.degrade_escalation_log
  FOR SELECT TO authenticated
  USING (public.assert_is_admin() = auth.uid());

-- ─── degrade_escalation_check_v1 ────────────────────────────────────────────
-- Checks if degrade has been active > 4h. If so, creates escalation record.
-- Idempotent: only creates one escalation per degrade entry event.

CREATE OR REPLACE FUNCTION public.degrade_escalation_check_v1()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ks boolean;
  v_ro boolean;
  v_level text;
  v_last_enter public.pf_degrade_audit%ROWTYPE;
  v_duration_hours numeric;
  v_already_escalated boolean;
BEGIN
  SELECT enabled INTO v_ks FROM public.game_authority_flags WHERE key = 'kill_switch';
  IF NOT COALESCE(v_ks, false) THEN
    RETURN json_build_object('action', 'ok', 'reason', 'not_in_degrade');
  END IF;

  SELECT enabled INTO v_ro FROM public.game_authority_flags WHERE key = 'read_only_resume';
  v_level := CASE WHEN COALESCE(v_ro, true) THEN 'L2' ELSE 'L3' END;

  SELECT * INTO v_last_enter FROM public.pf_degrade_audit
  WHERE event IN ('L2_enter', 'L3_enter')
  ORDER BY created_at DESC LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('action', 'ok', 'reason', 'no_degrade_entry_found');
  END IF;

  v_duration_hours := EXTRACT(EPOCH FROM (now() - v_last_enter.created_at)) / 3600.0;

  IF v_duration_hours < 4 THEN
    RETURN json_build_object(
      'action', 'ok',
      'level', v_level,
      'duration_hours', round(v_duration_hours::numeric, 2),
      'threshold_hours', 4
    );
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.degrade_escalation_log
    WHERE entered_at = v_last_enter.created_at
  ) INTO v_already_escalated;

  IF v_already_escalated THEN
    RETURN json_build_object(
      'action', 'already_escalated',
      'level', v_level,
      'duration_hours', round(v_duration_hours::numeric, 2)
    );
  END IF;

  INSERT INTO public.degrade_escalation_log (level, duration_hours, entered_at)
  VALUES (v_level, round(v_duration_hours::numeric, 2), v_last_enter.created_at);

  RETURN json_build_object(
    'action', 'escalated',
    'level', v_level,
    'duration_hours', round(v_duration_hours::numeric, 2),
    'entered_at', v_last_enter.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.degrade_escalation_check_v1() FROM PUBLIC, anon, authenticated;

-- ─── daily_metric_alarm_v1 ──────────────────────────────────────────────────
-- Daily health check: counts anomalies in last 24h.
-- Returns summary for monitoring dashboard or webhook consumption.

CREATE OR REPLACE FUNCTION public.daily_metric_alarm_v1()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_rounds int;
  v_failed_rounds int;
  v_degrade_events int;
  v_escalations int;
  v_reconciliation_alerts int;
  v_auto_bet_errors int;
  v_alarms jsonb := '[]'::jsonb;
BEGIN
  SELECT count(*)::int INTO v_total_rounds
  FROM public.game_active_sessions
  WHERE created_at > now() - interval '24 hours';

  SELECT count(*)::int INTO v_failed_rounds
  FROM public.game_active_sessions
  WHERE created_at > now() - interval '24 hours'
    AND status = 'active'
    AND updated_at < now() - interval '1 hour';

  SELECT count(*)::int INTO v_degrade_events
  FROM public.pf_degrade_audit
  WHERE created_at > now() - interval '24 hours';

  SELECT count(*)::int INTO v_escalations
  FROM public.degrade_escalation_log
  WHERE created_at > now() - interval '24 hours';

  SELECT count(*)::int INTO v_reconciliation_alerts
  FROM public.reconciliation_alerts
  WHERE created_at > now() - interval '24 hours';

  SELECT count(*)::int INTO v_auto_bet_errors
  FROM public.auto_bet_sessions
  WHERE updated_at > now() - interval '24 hours'
    AND stop_reason = 'error';

  IF v_failed_rounds > 0 THEN
    v_alarms := v_alarms || jsonb_build_object('type', 'stale_rounds', 'count', v_failed_rounds);
  END IF;
  IF v_degrade_events > 0 THEN
    v_alarms := v_alarms || jsonb_build_object('type', 'degrade_events', 'count', v_degrade_events);
  END IF;
  IF v_escalations > 0 THEN
    v_alarms := v_alarms || jsonb_build_object('type', 'escalations', 'count', v_escalations);
  END IF;
  IF v_reconciliation_alerts > 10 THEN
    v_alarms := v_alarms || jsonb_build_object('type', 'reconciliation_alerts_high', 'count', v_reconciliation_alerts);
  END IF;
  IF v_auto_bet_errors > 5 THEN
    v_alarms := v_alarms || jsonb_build_object('type', 'auto_bet_errors_high', 'count', v_auto_bet_errors);
  END IF;

  RETURN json_build_object(
    'period', '24h',
    'total_rounds', v_total_rounds,
    'stale_rounds', v_failed_rounds,
    'degrade_events', v_degrade_events,
    'escalations', v_escalations,
    'reconciliation_alerts', v_reconciliation_alerts,
    'auto_bet_errors', v_auto_bet_errors,
    'alarms', v_alarms,
    'alarm_count', jsonb_array_length(v_alarms),
    'checked_at', now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.daily_metric_alarm_v1() FROM PUBLIC, anon, authenticated;

-- ─── Cron: escalation check every hour ──────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension unavailable — enable in Supabase Dashboard first';
    RETURN;
  END IF;

  DECLARE v_job_id bigint;
  BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'degrade-escalation-check' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;
  END;

  PERFORM cron.schedule(
    'degrade-escalation-check',
    '0 * * * *',
    $cron$SELECT public.degrade_escalation_check_v1();$cron$
  );
  RAISE NOTICE 'Scheduled degrade-escalation-check (every hour)';

  DECLARE v_job_id2 bigint;
  BEGIN
    SELECT jobid INTO v_job_id2 FROM cron.job WHERE jobname = 'daily-metric-alarm' LIMIT 1;
    IF v_job_id2 IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id2);
    END IF;
  END;

  PERFORM cron.schedule(
    'daily-metric-alarm',
    '0 9 * * *',
    $cron$SELECT public.daily_metric_alarm_v1();$cron$
  );
  RAISE NOTICE 'Scheduled daily-metric-alarm (9 AM UTC daily)';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Cron schedule failed: %', SQLERRM;
END $$;
