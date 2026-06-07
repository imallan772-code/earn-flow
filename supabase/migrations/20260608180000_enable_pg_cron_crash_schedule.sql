-- Enable pg_cron (Supabase: may require Dashboard toggle first) and (re)schedule crash stale settle.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron extension unavailable — enable in Supabase Dashboard → Database → Extensions';
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

  RAISE NOTICE 'crash-force-settle-stale scheduled (*/5 * * * *)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'crash-force-settle-stale schedule failed: %', SQLERRM;
END $$;
