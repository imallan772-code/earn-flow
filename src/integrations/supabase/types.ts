export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          created_at: string;
          id: string;
          nickname: string | null;
          onboarding_completed: boolean;
          onboarding_step: number;
          referral_code: string;
          streak_days: number;
          updated_at: string;
          vip_progress: number;
          vip_tier: string;
        };
        Insert: {
          created_at?: string;
          id: string;
          nickname?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          referral_code: string;
          streak_days?: number;
          updated_at?: string;
          vip_progress?: number;
          vip_tier?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          nickname?: string | null;
          onboarding_completed?: boolean;
          onboarding_step?: number;
          referral_code?: string;
          streak_days?: number;
          updated_at?: string;
          vip_progress?: number;
          vip_tier?: string;
        };
        Relationships: [];
      };
      wallet_balances: {
        Row: {
          krw: number;
          phon: number;
          updated_at: string;
          usdt: number;
          user_id: string;
        };
        Insert: {
          krw?: number;
          phon?: number;
          updated_at?: string;
          usdt?: number;
          user_id: string;
        };
        Update: {
          krw?: number;
          phon?: number;
          updated_at?: string;
          usdt?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      mission_templates: {
        Row: {
          id: string;
          title: string;
          reward: number;
          kind: string;
          urgency: string | null;
          total: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      user_missions: {
        Row: {
          user_id: string;
          mission_id: string;
          period_key: string;
          progress: number;
          claimed_at: string | null;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      admin_users: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: { user_id?: string; created_at?: string };
        Relationships: [];
      };
      notices: {
        Row: {
          id: string;
          category: string;
          title: string;
          excerpt: string;
          body: string;
          pinned: boolean;
          published_at: string;
          author: string;
          is_published: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          status: string;
          title: string;
          tagline: string;
          body: string;
          reward_preview: string;
          starts_at: string;
          ends_at: string;
          participants: number;
          cap: number | null;
          cta_label: string;
          terms: Json;
          bg_from: string;
          bg_to: string;
          progress: number;
          is_published: boolean;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      event_leaderboard: {
        Row: {
          event_id: string;
          rank: number;
          nickname: string;
          score: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      money_idempotency_ledger: {
        Row: {
          user_id: string;
          operation: string;
          idempotency_key: string;
          amount: number;
          response: Json;
          created_at: string;
        };
        Insert: {
          user_id: string;
          operation: string;
          idempotency_key: string;
          amount: number;
          response: Json;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          operation?: string;
          idempotency_key?: string;
          amount?: number;
          response?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      markets: {
        Row: {
          symbol: string;
          base_asset: string;
          quote_asset: string;
          tick_size: number;
          min_qty: number;
          is_active: boolean;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      market_candles: {
        Row: {
          symbol: string;
          time: number;
          open: number;
          high: number;
          low: number;
          close: number;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      trading_orders: {
        Row: {
          id: string;
          user_id: string;
          symbol: string;
          side: string;
          qty: number;
          fill_price: number;
          notional: number;
          status: string;
          created_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      trading_positions: {
        Row: {
          user_id: string;
          symbol: string;
          qty: number;
          avg_price: number;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      game_rounds: {
        Row: {
          id: string;
          user_id: string;
          game: string;
          round_id: string;
          bet_amount: number;
          payout_amount: number;
          created_at: string;
          refunded_at: string | null;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      game_active_sessions: {
        Row: {
          id: string;
          user_id: string;
          game: string;
          round_id: string;
          bet_amount: number;
          client_state: Json;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
      game_session_secrets: {
        Row: { session_id: string; mines: number[] };
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding_step: {
        Args: { p_nickname?: string; p_step_index: number };
        Returns: Json;
      };
      generate_referral_code: { Args: never; Returns: string };
      debit_phon_for_bet: {
        Args: { p_amount: number; p_game: string; p_round_id: string };
        Returns: Json;
      };
      credit_phon_for_payout: {
        Args: { p_amount: number; p_game: string; p_round_id: string };
        Returns: Json;
      };
      debit_phon_for_bet_v2: {
        Args: { p_amount: number; p_game: string; p_round_id: string };
        Returns: Json;
      };
      credit_phon_for_payout_v2: {
        Args: { p_amount: number; p_game: string; p_round_id: string };
        Returns: Json;
      };
      refund_phon_for_bet_v2: {
        Args: { p_amount: number; p_game: string; p_round_id: string };
        Returns: Json;
      };
      list_user_missions: { Args: never; Returns: Json };
      record_mission_progress: {
        Args: { p_mission_id: string; p_delta?: number };
        Returns: Json;
      };
      claim_mission_reward: { Args: { p_mission_id: string }; Returns: Json };
      list_events: { Args: never; Returns: Json };
      list_notices: { Args: never; Returns: Json };
      is_admin: { Args: never; Returns: boolean };
      admin_list_notices: { Args: never; Returns: Json };
      admin_upsert_notice: { Args: { p_payload: Json }; Returns: Json };
      admin_delete_notice: { Args: { p_id: string }; Returns: Json };
      admin_list_events: { Args: never; Returns: Json };
      admin_upsert_event: { Args: { p_payload: Json }; Returns: Json };
      admin_delete_event: { Args: { p_id: string }; Returns: Json };
      admin_dashboard_stats: { Args: never; Returns: Json };
      join_event: { Args: { p_event_id: string }; Returns: Json };
      get_event_leaderboard: { Args: { p_event_id: string }; Returns: Json };
      fetch_market_candles: {
        Args: { p_symbol: string; p_limit?: number };
        Returns: Json;
      };
      list_user_positions: { Args: never; Returns: Json };
      place_market_order: {
        Args: { p_symbol: string; p_side: string; p_qty: number };
        Returns: Json;
      };
      log_game_round: {
        Args: {
          p_game: string;
          p_round_id: string;
          p_bet_amount?: number;
          p_payout_amount?: number;
        };
        Returns: Json;
      };
      money_validate_bet_input: {
        Args: { p_amount: number; p_game: string; p_round_id: string };
        Returns: undefined;
      };
      get_game_active_session_v1: { Args: { p_game: string }; Returns: Json };
      sync_game_active_session_v1: {
        Args: {
          p_game: string;
          p_round_id: string;
          p_bet_amount: number;
          p_client_state: Json;
        };
        Returns: Json;
      };
      clear_game_active_session_v1: {
        Args: { p_game: string; p_round_id: string };
        Returns: boolean;
      };
      mines_start_round_v1: {
        Args: {
          p_amount: number;
          p_round_id: string;
          p_mine_count: number;
          p_client_seed: string;
          p_nonce: number;
          p_server_seed?: string;
        };
        Returns: Json;
      };
      mines_reveal_tile_v1: {
        Args: { p_round_id: string; p_tile: number };
        Returns: Json;
      };
      mines_cashout_v1: {
        Args: { p_round_id: string; p_gross_payout: number };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type WalletBalance = Database["public"]["Tables"]["wallet_balances"]["Row"];

export type OnboardingStepResult = {
  reward: number;
  profile: Profile;
  balance: WalletBalance;
};
