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

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isConfigured: boolean;
  refreshProfile: () => Promise<Profile | null>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
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

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      hydrate(nextSession);
    });

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
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
    setSession(null);
    setStatus("unauthenticated");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      isConfigured,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
      signOut,
    }),
    [
      status,
      session,
      profile,
      isConfigured,
      refreshProfile,
      signInWithEmail,
      signUpWithEmail,
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
