-- GA-A/D/E: RPC EXECUTE hardening for new Game Authority functions.
-- Matches pattern from 20260606220000_rpc_execute_hardening.sql

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.crash_compute_point_e6(text,text,bigint)'::regprocedure,
    'public.crash_multiplier_at_e6(bigint)'::regprocedure,
    'public.crash_force_settle_stale_v1(bigint)'::regprocedure,
    'public.pf_server_seed_hash(text)'::regprocedure,
    'public.auth_is_anonymous()'::regprocedure,
    'public.pf_generate_server_seed()'::regprocedure,
    'public.ensure_user_settings_v1(uuid)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.mines_cashout_v2(text)'::regprocedure,
    'public.resolve_user_mode_v1()'::regprocedure,
    'public.user_get_settings_v1()'::regprocedure,
    'public.user_set_preferred_mode_v1(text)'::regprocedure,
    'public.pf_session_create_or_get_v1(text,text)'::regprocedure,
    'public.pf_session_set_client_seed_v1(text,text)'::regprocedure,
    'public.pf_session_rotate_v1(text)'::regprocedure,
    'public.crash_place_v1(bigint,text,bigint,text)'::regprocedure,
    'public.crash_cashout_v1(text,bigint)'::regprocedure,
    'public.crash_sync_v1(text)'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;
