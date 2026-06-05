export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
