-- GA-M: pg_cron job for PF health check (every 1 minute).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension unavailable — enable in Supabase Dashboard first';
    RETURN;
  END IF;

  -- Remove old job if exists
  DECLARE v_job_id bigint;
  BEGIN
    SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'pf-health-check' LIMIT 1;
    IF v_job_id IS NOT NULL THEN
      PERFORM cron.unschedule(v_job_id);
    END IF;
  END;

  PERFORM cron.schedule(
    'pf-health-check',
    '* * * * *',
    $cron$SELECT public.pf_health_check_v1();$cron$
  );

  RAISE NOTICE 'Scheduled pf-health-check (every minute)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pf-health-check schedule failed: %', SQLERRM;
END $$;
