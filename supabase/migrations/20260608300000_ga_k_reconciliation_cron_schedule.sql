-- GA-K: pg_cron daily reconciliation at 03:00 KST (18:00 UTC).

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — schedule reconciliation daily manually';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'reconciliation-daily' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'reconciliation-daily',
    '0 18 * * *',
    $cron$SELECT public.reconciliation_run_daily_v1();$cron$
  );

  RAISE NOTICE 'Scheduled reconciliation-daily (03:00 KST = 18:00 UTC)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'reconciliation-daily schedule skipped: %', SQLERRM;
END $$;
