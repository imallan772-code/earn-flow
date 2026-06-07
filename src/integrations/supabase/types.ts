export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      event_leaderboard: {
        Row: {
          event_id: string
          nickname: string
          rank: number
          score: number
        }
        Insert: {
          event_id: string
          nickname: string
          rank: number
          score?: number
        }
        Update: {
          event_id?: string
          nickname?: string
          rank?: number
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_leaderboard_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_participants: {
        Row: {
          event_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          event_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          event_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          bg_from: string
          bg_to: string
          body: string
          cap: number | null
          created_at: string
          cta_label: string
          ends_at: string
          id: string
          is_published: boolean
          participants: number
          progress: number
          reward_preview: string
          starts_at: string
          status: string
          tagline: string
          terms: Json
          title: string
        }
        Insert: {
          bg_from?: string
          bg_to?: string
          body: string
          cap?: number | null
          created_at?: string
          cta_label?: string
          ends_at: string
          id: string
          is_published?: boolean
          participants?: number
          progress?: number
          reward_preview: string
          starts_at: string
          status: string
          tagline: string
          terms?: Json
          title: string
        }
        Update: {
          bg_from?: string
          bg_to?: string
          body?: string
          cap?: number | null
          created_at?: string
          cta_label?: string
          ends_at?: string
          id?: string
          is_published?: boolean
          participants?: number
          progress?: number
          reward_preview?: string
          starts_at?: string
          status?: string
          tagline?: string
          terms?: Json
          title?: string
        }
        Relationships: []
      }
      game_active_sessions: {
        Row: {
          bet_amount: number
          client_state: Json
          created_at: string
          game: string
          id: string
          round_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bet_amount?: number
          client_state?: Json
          created_at?: string
          game: string
          id?: string
          round_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          client_state?: Json
          created_at?: string
          game?: string
          id?: string
          round_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_rounds: {
        Row: {
          bet_amount: number
          bet_mode: string | null
          bet_params: Json | null
          created_at: string
          game: string
          id: string
          multiplier_e6: number | null
          payout_amount: number
          pf_session_id: string | null
          refunded_at: string | null
          round_id: string
          user_id: string
        }
        Insert: {
          bet_amount?: number
          bet_mode?: string | null
          bet_params?: Json | null
          created_at?: string
          game: string
          id?: string
          multiplier_e6?: number | null
          payout_amount?: number
          pf_session_id?: string | null
          refunded_at?: string | null
          round_id: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          bet_mode?: string | null
          bet_params?: Json | null
          created_at?: string
          game?: string
          id?: string
          multiplier_e6?: number | null
          payout_amount?: number
          pf_session_id?: string | null
          refunded_at?: string | null
          round_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_rounds_pf_session_id_fkey"
            columns: ["pf_session_id"]
            isOneToOne: false
            referencedRelation: "pf_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pf_sessions: {
        Row: {
          client_seed: string
          created_at: string
          game: string
          id: string
          nonce: number
          rotated_at: string | null
          server_seed: string
          server_seed_hash: string
          status: string
          user_id: string
        }
        Insert: {
          client_seed?: string
          created_at?: string
          game: string
          id?: string
          nonce?: number
          rotated_at?: string | null
          server_seed: string
          server_seed_hash: string
          status?: string
          user_id: string
        }
        Update: {
          client_seed?: string
          created_at?: string
          game?: string
          id?: string
          nonce?: number
          rotated_at?: string | null
          server_seed?: string
          server_seed_hash?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          auto_bet_consent_at: string | null
          daily_loss_limit_pct: number | null
          daily_loss_limit_phon: number | null
          daily_round_limit: number
          max_consecutive_losses: number | null
          preferred_mode: string
          region: string
          safety_tier: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_bet_consent_at?: string | null
          daily_loss_limit_pct?: number | null
          daily_loss_limit_phon?: number | null
          daily_round_limit?: number
          max_consecutive_losses?: number | null
          preferred_mode?: string
          region?: string
          safety_tier?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_bet_consent_at?: string | null
          daily_loss_limit_pct?: number | null
          daily_loss_limit_phon?: number | null
          daily_round_limit?: number
          max_consecutive_losses?: number | null
          preferred_mode?: string
          region?: string
          safety_tier?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_session_secrets: {
        Row: {
          crash_point_e6: number | null
          mines: number[] | null
          session_id: string
        }
        Insert: {
          crash_point_e6?: number | null
          mines?: number[] | null
          session_id: string
        }
        Update: {
          crash_point_e6?: number | null
          mines?: number[] | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_session_secrets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "game_active_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_bets: {
        Row: {
          amount: number
          created_at: string
          display_name: string
          event_key: string
          game: string
          id: string
          mode: string
          multiplier: number | null
          profit: number | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          display_name: string
          event_key: string
          game: string
          id?: string
          mode?: string
          multiplier?: number | null
          profit?: number | null
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          display_name?: string
          event_key?: string
          game?: string
          id?: string
          mode?: string
          multiplier?: number | null
          profit?: number | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      market_candles: {
        Row: {
          close: number
          high: number
          low: number
          open: number
          symbol: string
          time: number
        }
        Insert: {
          close: number
          high: number
          low: number
          open: number
          symbol: string
          time: number
        }
        Update: {
          close?: number
          high?: number
          low?: number
          open?: number
          symbol?: string
          time?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_candles_symbol_fkey"
            columns: ["symbol"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["symbol"]
          },
        ]
      }
      markets: {
        Row: {
          base_asset: string
          is_active: boolean
          min_qty: number
          quote_asset: string
          symbol: string
          tick_size: number
        }
        Insert: {
          base_asset: string
          is_active?: boolean
          min_qty?: number
          quote_asset?: string
          symbol: string
          tick_size?: number
        }
        Update: {
          base_asset?: string
          is_active?: boolean
          min_qty?: number
          quote_asset?: string
          symbol?: string
          tick_size?: number
        }
        Relationships: []
      }
      mission_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          reward: number
          sort_order: number
          title: string
          total: number
          urgency: string | null
        }
        Insert: {
          created_at?: string
          id: string
          is_active?: boolean
          kind: string
          reward: number
          sort_order?: number
          title: string
          total?: number
          urgency?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          reward?: number
          sort_order?: number
          title?: string
          total?: number
          urgency?: string | null
        }
        Relationships: []
      }
      money_idempotency_ledger: {
        Row: {
          amount: number
          created_at: string
          idempotency_key: string
          operation: string
          response: Json
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          idempotency_key: string
          operation: string
          response: Json
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          idempotency_key?: string
          operation?: string
          response?: Json
          user_id?: string
        }
        Relationships: []
      }
      notices: {
        Row: {
          author: string
          body: string
          category: string
          created_at: string
          excerpt: string
          id: string
          is_published: boolean
          pinned: boolean
          published_at: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string
          body?: string
          category: string
          created_at?: string
          excerpt?: string
          id: string
          is_published?: boolean
          pinned?: boolean
          published_at: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          body?: string
          category?: string
          created_at?: string
          excerpt?: string
          id?: string
          is_published?: boolean
          pinned?: boolean
          published_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          nickname: string | null
          onboarding_completed: boolean
          onboarding_step: number
          referral_code: string
          streak_days: number
          updated_at: string
          vip_progress: number
          vip_tier: string
        }
        Insert: {
          created_at?: string
          id: string
          nickname?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          referral_code: string
          streak_days?: number
          updated_at?: string
          vip_progress?: number
          vip_tier?: string
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string | null
          onboarding_completed?: boolean
          onboarding_step?: number
          referral_code?: string
          streak_days?: number
          updated_at?: string
          vip_progress?: number
          vip_tier?: string
        }
        Relationships: []
      }
      promo_assets: {
        Row: {
          alt: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          prompt: string | null
          url: string
        }
        Insert: {
          alt?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id: string
          kind: string
          prompt?: string | null
          url?: string
        }
        Update: {
          alt?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          prompt?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_campaigns: {
        Row: {
          ab_ratio: number
          audience: string | null
          brief: Json
          channels: string[]
          created_at: string
          created_by: string | null
          goal: string | null
          hero_asset_id: string | null
          id: string
          length: string | null
          risk_score: number
          scheduled_at: string | null
          slug: string
          status: string
          target_url: string
          title: string
          tone: number | null
          updated_at: string
        }
        Insert: {
          ab_ratio?: number
          audience?: string | null
          brief?: Json
          channels?: string[]
          created_at?: string
          created_by?: string | null
          goal?: string | null
          hero_asset_id?: string | null
          id: string
          length?: string | null
          risk_score?: number
          scheduled_at?: string | null
          slug: string
          status?: string
          target_url?: string
          title?: string
          tone?: number | null
          updated_at?: string
        }
        Update: {
          ab_ratio?: number
          audience?: string | null
          brief?: Json
          channels?: string[]
          created_at?: string
          created_by?: string | null
          goal?: string | null
          hero_asset_id?: string | null
          id?: string
          length?: string | null
          risk_score?: number
          scheduled_at?: string | null
          slug?: string
          status?: string
          target_url?: string
          title?: string
          tone?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      promo_clicks: {
        Row: {
          campaign_id: string
          channel: string
          created_at: string
          id: string
          ip_hash: string | null
          referrer: string | null
          ua_hash: string | null
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          channel?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          ua_hash?: string | null
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          channel?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          referrer?: string | null
          ua_hash?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_clicks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_dispatches: {
        Row: {
          campaign_id: string
          channel: string
          error: string | null
          external_id: string | null
          id: string
          sent_at: string
          status: string
          variant_id: string | null
        }
        Insert: {
          campaign_id: string
          channel: string
          error?: string | null
          external_id?: string | null
          id?: string
          sent_at?: string
          status?: string
          variant_id?: string | null
        }
        Update: {
          campaign_id?: string
          channel?: string
          error?: string | null
          external_id?: string | null
          id?: string
          sent_at?: string
          status?: string
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_dispatches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promo_dispatches_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "promo_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_settings: {
        Row: {
          ab_ratio: number
          banned_words: string[]
          brand_voice: string
          default_utm: Json
          id: string
          quiet_hours: Json
          updated_at: string
        }
        Insert: {
          ab_ratio?: number
          banned_words?: string[]
          brand_voice?: string
          default_utm?: Json
          id?: string
          quiet_hours?: Json
          updated_at?: string
        }
        Update: {
          ab_ratio?: number
          banned_words?: string[]
          brand_voice?: string
          default_utm?: Json
          id?: string
          quiet_hours?: Json
          updated_at?: string
        }
        Relationships: []
      }
      promo_variants: {
        Row: {
          body: string
          campaign_id: string
          channel: string
          created_at: string
          cta: string | null
          hashtags: string[]
          id: string
          image_url: string | null
          label: string
          utm: Json
          weight: number
        }
        Insert: {
          body?: string
          campaign_id: string
          channel: string
          created_at?: string
          cta?: string | null
          hashtags?: string[]
          id: string
          image_url?: string | null
          label?: string
          utm?: Json
          weight?: number
        }
        Update: {
          body?: string
          campaign_id?: string
          channel?: string
          created_at?: string
          cta?: string | null
          hashtags?: string[]
          id?: string
          image_url?: string | null
          label?: string
          utm?: Json
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_variants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      trading_orders: {
        Row: {
          created_at: string
          fill_price: number
          id: string
          notional: number
          qty: number
          side: string
          status: string
          symbol: string
          user_id: string
        }
        Insert: {
          created_at?: string
          fill_price: number
          id?: string
          notional: number
          qty: number
          side: string
          status?: string
          symbol: string
          user_id: string
        }
        Update: {
          created_at?: string
          fill_price?: number
          id?: string
          notional?: number
          qty?: number
          side?: string
          status?: string
          symbol?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_orders_symbol_fkey"
            columns: ["symbol"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["symbol"]
          },
        ]
      }
      trading_positions: {
        Row: {
          avg_price: number
          qty: number
          symbol: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avg_price?: number
          qty?: number
          symbol: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avg_price?: number
          qty?: number
          symbol?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trading_positions_symbol_fkey"
            columns: ["symbol"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["symbol"]
          },
        ]
      }
      user_missions: {
        Row: {
          claimed_at: string | null
          mission_id: string
          period_key: string
          progress: number
          updated_at: string
          user_id: string
        }
        Insert: {
          claimed_at?: string | null
          mission_id: string
          period_key?: string
          progress?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          claimed_at?: string | null
          mission_id?: string
          period_key?: string
          progress?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_missions_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "mission_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_balances: {
        Row: {
          krw: number
          phon: number
          updated_at: string
          usdt: number
          user_id: string
        }
        Insert: {
          krw?: number
          phon?: number
          updated_at?: string
          usdt?: number
          user_id: string
        }
        Update: {
          krw?: number
          phon?: number
          updated_at?: string
          usdt?: number
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_dashboard_stats: { Args: never; Returns: Json }
      admin_delete_event: { Args: { p_id: string }; Returns: Json }
      admin_delete_notice: { Args: { p_id: string }; Returns: Json }
      admin_delete_promo_campaign: {
        Args: { p_id: string }
        Returns: undefined
      }
      admin_get_promo_settings: { Args: never; Returns: Json }
      admin_list_events: { Args: never; Returns: Json }
      admin_list_notices: { Args: never; Returns: Json }
      admin_list_promo_assets: { Args: never; Returns: Json }
      admin_list_promo_campaigns: { Args: never; Returns: Json }
      admin_list_promo_dispatches: {
        Args: { p_campaign_id?: string }
        Returns: Json
      }
      admin_list_promo_clicks: {
        Args: { p_campaign_id?: string; p_from?: string; p_to?: string }
        Returns: Json
      }
      admin_promo_analytics_summary: {
        Args: { p_from?: string; p_to?: string }
        Returns: Json
      }
      admin_record_promo_dispatch: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_event: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_notice: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_promo_asset: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_promo_campaign: { Args: { p_payload: Json }; Returns: Json }
      admin_upsert_promo_settings: { Args: { p_payload: Json }; Returns: Json }
      assert_is_admin: { Args: never; Returns: string }
      claim_mission_reward: { Args: { p_mission_id: string }; Returns: Json }
      clear_game_active_session_v1: {
        Args: { p_game: string; p_round_id: string }
        Returns: boolean
      }
      crash_cashout_v1: {
        Args: { p_at_multiplier_e6: number; p_round_id: string }
        Returns: Json
      }
      crash_place_v1: {
        Args: {
          p_amount: number
          p_auto_target_e6?: number
          p_client_seed?: string
          p_round_id: string
        }
        Returns: Json
      }
      crash_start_running_v1: { Args: { p_round_id: string }; Returns: Json }
      crash_sync_v1: { Args: { p_round_id: string }; Returns: Json }
      crash_force_settle_stale_v1: {
        Args: { p_max_age_ms?: number }
        Returns: number
      }
      dice_complete_v1: { Args: { p_round_id: string }; Returns: boolean }
      dice_place_v1: {
        Args: {
          p_amount: number
          p_client_seed?: string
          p_dice_mode: string
          p_round_id: string
          p_target: number
        }
        Returns: Json
      }
      dice_sync_v1: { Args: { p_round_id: string }; Returns: Json }
      limbo_complete_v1: { Args: { p_round_id: string }; Returns: boolean }
      limbo_place_v1: {
        Args: {
          p_amount: number
          p_client_seed?: string
          p_round_id: string
          p_target: number
        }
        Returns: Json
      }
      limbo_sync_v1: { Args: { p_round_id: string }; Returns: Json }
      wheel_complete_v1: { Args: { p_round_id: string }; Returns: boolean }
      wheel_place_v1: {
        Args: {
          p_amount: number
          p_client_seed?: string
          p_risk: string
          p_round_id: string
          p_segments: number
        }
        Returns: Json
      }
      wheel_sync_v1: { Args: { p_round_id: string }; Returns: Json }
      plinko_complete_v1: { Args: { p_round_id: string }; Returns: Json }
      plinko_enqueue_v1: {
        Args: {
          p_amount: number
          p_client_seed?: string
          p_risk: string
          p_round_id: string
          p_rows: number
        }
        Returns: Json
      }
      plinko_force_settle_stale_v1: { Args: { p_max_age_ms?: number }; Returns: number }
      plinko_list_pending_v1: { Args: Record<string, never>; Returns: Json }
      plinko_sync_v1: { Args: { p_round_id: string }; Returns: Json }
      auto_bet_create_v1: {
        Args: { p_bet_params?: Json; p_config: Json; p_game: string }
        Returns: Json
      }
      auto_bet_grant_consent_v1: { Args: Record<string, never>; Returns: Json }
      auto_bet_list_v1: { Args: Record<string, never>; Returns: Json }
      auto_bet_pause_v1: { Args: { p_session_id: string }; Returns: Json }
      auto_bet_resume_v1: { Args: { p_session_id: string }; Returns: Json }
      auto_bet_stop_v1: { Args: { p_session_id: string }; Returns: Json }
      auto_bet_sync_v1: { Args: { p_session_id: string }; Returns: Json }
      auto_bet_worker_tick_v1: { Args: { p_batch_limit?: number }; Returns: number }
      audit_export_month_v1: { Args: { p_yyyy_mm: string }; Returns: Json }
      debit_phon_for_bet_v3: { Args: { p_amount: number; p_game: string; p_round_id: string }; Returns: Json }
      credit_phon_for_payout_v3: {
        Args: { p_amount: number; p_game: string; p_round_id: string }
        Returns: Json
      }
      money_wallet_invariant_v1: { Args: Record<string, never>; Returns: Json }
      kill_switch_status_v1: { Args: Record<string, never>; Returns: Json }
      admin_enter_l2_v1: { Args: { p_reason: string }; Returns: Json }
      admin_enter_l3_v1: { Args: { p_reason: string }; Returns: Json }
      admin_exit_degrade_v1: { Args: { p_reason: string }; Returns: Json }
      reconciliation_probe_v1: {
        Args: { p_bet: number; p_multiplier: number; p_multiplier_e6?: number }
        Returns: Json
      }
      reconciliation_run_daily_v1: { Args: Record<string, never>; Returns: Json }
      game_authority_flag_v1: { Args: { p_key: string }; Returns: boolean }
      complete_onboarding_step: {
        Args: { p_nickname?: string; p_step_index: number }
        Returns: Json
      }
      credit_phon_for_payout: {
        Args: { p_amount: number; p_game: string; p_round_id: string }
        Returns: Json
      }
      credit_phon_for_payout_v2: {
        Args: { p_amount: number; p_game: string; p_round_id: string }
        Returns: Json
      }
      cron_get_promo_settings: { Args: never; Returns: Json }
      cron_list_due_promo_campaigns: { Args: { p_now?: string }; Returns: Json }
      cron_mark_promo_campaign_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      cron_record_promo_dispatch: { Args: { p_payload: Json }; Returns: Json }
      debit_phon_for_bet: {
        Args: { p_amount: number; p_game: string; p_round_id: string }
        Returns: Json
      }
      debit_phon_for_bet_v2: {
        Args: { p_amount: number; p_game: string; p_round_id: string }
        Returns: Json
      }
      fetch_market_candles: {
        Args: { p_limit?: number; p_symbol: string }
        Returns: Json
      }
      generate_referral_code: { Args: never; Returns: string }
      get_event_leaderboard: { Args: { p_event_id: string }; Returns: Json }
      get_game_active_session_v1: { Args: { p_game: string }; Returns: Json }
      is_admin: { Args: never; Returns: boolean }
      join_event: { Args: { p_event_id: string }; Returns: Json }
      list_events: { Args: never; Returns: Json }
      list_notices: { Args: never; Returns: Json }
      list_user_missions: { Args: never; Returns: Json }
      list_user_positions: { Args: never; Returns: Json }
      live_bet_mask_display: { Args: { p_user_id: string }; Returns: string }
      log_game_round: {
        Args: {
          p_bet_amount?: number
          p_game: string
          p_payout_amount?: number
          p_round_id: string
        }
        Returns: Json
      }
      mines_cashout_v1: {
        Args: { p_gross_payout: number; p_round_id: string }
        Returns: Json
      }
      mines_cashout_v2: {
        Args: { p_round_id: string }
        Returns: Json
      }
      mines_clamp_count: { Args: { p_mine_count: number }; Returns: number }
      mines_generate_layout: {
        Args: {
          p_client_seed: string
          p_mine_count: number
          p_nonce: number
          p_server_seed: string
        }
        Returns: number[]
      }
      mines_next_multiplier: {
        Args: { p_mine_count: number; p_revealed: number }
        Returns: number
      }
      mines_reveal_tile_v1: {
        Args: { p_round_id: string; p_tile: number }
        Returns: Json
      }
      mines_start_round_v1: {
        Args: {
          p_amount: number
          p_client_seed: string
          p_mine_count: number
          p_nonce: number
          p_round_id: string
          p_server_seed?: string
        }
        Returns: Json
      }
      mission_period_key: { Args: { p_kind: string }; Returns: string }
      money_validate_bet_input: {
        Args: { p_amount: number; p_game: string; p_round_id: string }
        Returns: undefined
      }
      pf_session_create_or_get_v1: {
        Args: { p_client_seed?: string; p_game: string }
        Returns: Json
      }
      pf_session_rotate_v1: { Args: { p_game: string }; Returns: Json }
      pf_session_set_client_seed_v1: {
        Args: { p_client_seed: string; p_game: string }
        Returns: Json
      }
      pf_draw_float: {
        Args: {
          p_client_seed: string
          p_index: number
          p_nonce: number
          p_server_seed: string
        }
        Returns: number
      }
      pf_float_from_bytes: {
        Args: { p_bytes: string; p_offset: number }
        Returns: number
      }
      pf_hmac_bytes: {
        Args: {
          p_client_seed: string
          p_cursor: number
          p_nonce: number
          p_server_seed: string
        }
        Returns: string
      }
      place_market_order: {
        Args: { p_qty: number; p_side: string; p_symbol: string }
        Returns: Json
      }
      record_mission_progress: {
        Args: { p_delta?: number; p_mission_id: string }
        Returns: Json
      }
      record_promo_click: {
        Args: {
          p_channel?: string
          p_ip_hash?: string
          p_referrer?: string
          p_slug: string
          p_ua_hash?: string
          p_variant_id?: string
        }
        Returns: string
      }
      user_get_settings_v1: { Args: never; Returns: Json }
      user_set_preferred_mode_v1: { Args: { p_mode: string }; Returns: Json }
      resolve_user_mode_v1: { Args: never; Returns: string }
      refund_phon_for_bet_v2: {
        Args: { p_amount: number; p_game: string; p_round_id: string }
        Returns: Json
      }
      sync_game_active_session_v1: {
        Args: {
          p_bet_amount: number
          p_client_state: Json
          p_game: string
          p_round_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const;

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type WalletBalance = Database["public"]["Tables"]["wallet_balances"]["Row"];

export type OnboardingStepResult = {
  reward: number;
  profile: Profile;
  balance: WalletBalance;
};
