-- =============================================================================
-- Part 1: RPC EXECUTE hardening — internal + authenticated-only SSOT
-- Closes Supabase advisor lint 0028 (anon callable SECURITY DEFINER)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Internal: trigger / helper — no direct RPC surface
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.sync_live_bet_from_game_round()'::regprocedure,
    'public.live_bet_mask_display(uuid)'::regprocedure,
    'public.handle_new_user()'::regprocedure,
    'public.pf_hmac_bytes(text,text,bigint,int)'::regprocedure,
    'public.pf_float_from_bytes(bytea,int)'::regprocedure,
    'public.pf_draw_float(text,text,bigint,int)'::regprocedure,
    'public.mines_clamp_count(int)'::regprocedure,
    'public.mines_generate_layout(text,text,bigint,int)'::regprocedure,
    'public.mines_next_multiplier(int,int)'::regprocedure,
    'public.mission_period_key(text)'::regprocedure,
    'public.assert_is_admin()'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
  END LOOP;
END $$;

-- assert_is_admin: callable only from other SECURITY DEFINER functions (no client RPC)
GRANT EXECUTE ON FUNCTION public.assert_is_admin() TO postgres;

-- -----------------------------------------------------------------------------
-- Authenticated-only: REVOKE PUBLIC + anon, preserve authenticated GRANT
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.debit_phon_for_bet(bigint,text,text)'::regprocedure,
    'public.credit_phon_for_payout(bigint,text,text)'::regprocedure,
    'public.debit_phon_for_bet_v2(bigint,text,text)'::regprocedure,
    'public.credit_phon_for_payout_v2(bigint,text,text)'::regprocedure,
    'public.refund_phon_for_bet_v2(bigint,text,text)'::regprocedure,
    'public.money_validate_bet_input(bigint,text,text)'::regprocedure,
    'public.log_game_round(text,text,bigint,bigint)'::regprocedure,
    'public.complete_onboarding_step(integer,text)'::regprocedure,
    'public.list_user_missions()'::regprocedure,
    'public.record_mission_progress(text,int)'::regprocedure,
    'public.claim_mission_reward(text)'::regprocedure,
    'public.join_event(text)'::regprocedure,
    'public.list_user_positions()'::regprocedure,
    'public.place_market_order(text,text,numeric)'::regprocedure,
    'public.get_game_active_session_v1(text)'::regprocedure,
    'public.sync_game_active_session_v1(text,text,bigint,jsonb)'::regprocedure,
    'public.clear_game_active_session_v1(text,text)'::regprocedure,
    'public.mines_start_round_v1(bigint,text,int,text,bigint,text)'::regprocedure,
    'public.mines_reveal_tile_v1(text,int)'::regprocedure,
    'public.mines_cashout_v1(text,bigint)'::regprocedure,
    'public.is_admin()'::regprocedure,
    'public.admin_list_notices()'::regprocedure,
    'public.admin_upsert_notice(jsonb)'::regprocedure,
    'public.admin_delete_notice(text)'::regprocedure,
    'public.admin_list_events()'::regprocedure,
    'public.admin_upsert_event(jsonb)'::regprocedure,
    'public.admin_delete_event(text)'::regprocedure,
    'public.admin_dashboard_stats()'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- Public read RPCs — explicit allowlist (anon + authenticated)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn regprocedure;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.list_events()'::regprocedure,
    'public.get_event_leaderboard(text)'::regprocedure,
    'public.fetch_market_candles(text,int)'::regprocedure,
    'public.list_notices()'::regprocedure,
    'public.generate_referral_code()'::regprocedure
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon, authenticated', fn);
  END LOOP;
END $$;
