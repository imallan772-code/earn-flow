import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { Profile } from "@/integrations/supabase/types";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { ensureAnonymousSession } from "@/lib/auth/ensureAnonymousSession";
import { getAuthRedirectUrl } from "@/lib/auth/redirect";
import { setWalletScope } from "@/shared/wallet/walletStore";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True while the user must set a new password (recovery email link). */
  passwordRecovery: boolean;
  isConfigured: boolean;
  refreshProfile: () => Promise<Profile | null>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithPasskey: () => Promise<void>;
  registerPasskey: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<void>;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isConfigured = isSupabaseConfigured();
  const [status, setStatus] = useState<AuthStatus>(isConfigured ? "loading" : "unauthenticated");
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  const refreshProfile = useCallback(async () => {
    if (!session?.user) {
      setProfile(null);
      return null;
    }
    const next = await fetchProfile(session.user.id);
    setProfile(next);
    return next;
  }, [session?.user]);

  useEffect(() => {
    if (!isConfigured) return;

    const supabase = getSupabaseClient();
    let active = true;

    async function hydrate(currentSession: Session | null) {
      if (!active) return;
      setWalletScope(currentSession?.user?.id ?? null);
      setSession(currentSession);
      if (!currentSession?.user) {
        setProfile(null);
        setStatus("unauthenticated");
        return;
      }
      try {
        const nextProfile = await fetchProfile(currentSession.user.id);
        if (!active) return;
        setProfile(nextProfile);
        setStatus("authenticated");
      } catch {
        if (!active) return;
        setProfile(null);
        setStatus("authenticated");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      }
      if (event === "SIGNED_OUT") {
        setPasswordRecovery(false);
      }
      if (event === "USER_UPDATED") {
        setPasswordRecovery(false);
      }
      hydrate(nextSession);
    });

    async function initSession() {
      // /auth/callback owns PKCE exchange — avoid racing getSession here.
      if (typeof window !== "undefined" && window.location.pathname === "/auth/callback") {
        return;
      }

      const session = await ensureAnonymousSession(supabase);
      if (!active) return;
      await hydrate(session);
    }

    void initSession();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isConfigured]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl("/onboarding") },
    });
    if (error) throw error;
  }, []);

  const signInWithPasskey = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPasskey();
    if (error) throw error;
  }, []);

  const registerPasskey = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.registerPasskey();
    if (error) throw error;
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthRedirectUrl("/auth/callback"),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) throw error;
  }, []);

  const resetPasswordForEmail = useCallback(async (email: string) => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl("/reset-password"),
    });
    if (error) throw error;
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setPasswordRecovery(false);
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setSession(null);
    setPasswordRecovery(false);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      passwordRecovery,
      isConfigured,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithPasskey,
      registerPasskey,
      signInWithGoogle,
      resetPasswordForEmail,
      clearPasswordRecovery,
      signOut,
    }),
    [
      status,
      session,
      profile,
      passwordRecovery,
      isConfigured,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signInWithPasskey,
      registerPasskey,
      signInWithGoogle,
      resetPasswordForEmail,
      clearPasswordRecovery,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
