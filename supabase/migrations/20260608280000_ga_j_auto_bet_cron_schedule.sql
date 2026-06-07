-- GA-J: pg_cron schedule for auto-bet worker (every minute, batch tick).
-- Sub-minute latency: invoke Edge auto-bet-worker more frequently in production if needed.

DO $$
DECLARE
  v_job_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron not enabled — schedule auto-bet-worker manually';
    RETURN;
  END IF;

  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'auto-bet-worker-tick' LIMIT 1;
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;

  PERFORM cron.schedule(
    'auto-bet-worker-tick',
    '* * * * *',
    $cron$SELECT public.auto_bet_worker_tick_v1(300);$cron$
  );

  RAISE NOTICE 'Scheduled auto-bet-worker-tick (* * * * *)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'auto-bet-worker-tick schedule skipped: %', SQLERRM;
END $$;
