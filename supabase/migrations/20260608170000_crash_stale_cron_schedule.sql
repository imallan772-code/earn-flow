-- GA-E production: pg_cron every 5min → crash_force_settle_stale_v1 (60min max lifetime).
-- Requires pg_cron extension (Supabase Dashboard → Database → Extensions).
-- Idempotent: safe to re-run on db push.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — enable in Dashboard, then re-run migration or schedule manually';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'crash-force-settle-stale' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'crash-force-settle-stale',
    '*/5 * * * *',
    $cron$SELECT public.crash_force_settle_stale_v1();$cron$
  );

  RAISE NOTICE 'Scheduled crash-force-settle-stale (every 5 min)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'crash-force-settle-stale schedule skipped: %', SQLERRM;
END $$;

-- Edge function / ops invoke via service_role
GRANT EXECUTE ON FUNCTION public.crash_force_settle_stale_v1(bigint) TO service_role;
