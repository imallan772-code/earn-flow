/**
 * Global Demo / Real mode context.
 *
 * GA-A: server SSOT via resolve_user_mode_v1 / user_set_preferred_mode_v1.
 * Anonymous users are always demo. localStorage is display cache only when authenticated.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { preferredModeErrorMessage, resolveUserMode, setPreferredMode } from "@/lib/api/userSettings";
import { appToast } from "@/shared/ui/toast";

export type GameMode = "demo" | "real";

export const RTP: Record<GameMode, number> = {
  demo: 1.00,
  real: 1.00,
};

interface ModeContextValue {
  mode: GameMode;
  setMode: (m: GameMode) => void;
  toggle: () => void;
  rtpLabel: string;
  applyEdge: (rawMultiplier: number) => number;
  modeReady: boolean;
}

const ModeContext = createContext<ModeContextValue | null>(null);

function modeStorageKey(userId: string | null | undefined): string {
  return userId ? `phonara.mode.${userId}` : "phonara.mode.guest";
}

function readStoredMode(userId: string | null | undefined): GameMode {
  if (typeof window === "undefined") return "demo";
  const stored = window.localStorage.getItem(modeStorageKey(userId));
  return stored === "real" ? "real" : "demo";
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user, status, isConfigured } = useAuth();
  const userId = user?.id ?? null;
  const [mode, setModeState] = useState<GameMode>("demo");
  const [modeReady, setModeReady] = useState(!isConfigured);

  useEffect(() => {
    if (!isConfigured) {
      setModeState(readStoredMode(userId));
      setModeReady(true);
      return;
    }
    if (status === "loading") {
      setModeReady(false);
      return;
    }
    if (status !== "authenticated" || !user) {
      setModeState("demo");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(modeStorageKey(userId), "demo");
      }
      setModeReady(true);
      return;
    }
    if (user.is_anonymous) {
      setModeState("demo");
      if (typeof window !== "undefined") {
        window.localStorage.setItem(modeStorageKey(userId), "demo");
      }
      setModeReady(true);
      return;
    }
    let alive = true;
    void resolveUserMode()
      .then((m) => {
        if (!alive) return;
        setModeState(m);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(modeStorageKey(userId), m);
        }
        setModeReady(true);
      })
      .catch(() => {
        if (!alive) return;
        setModeState(readStoredMode(userId));
        setModeReady(true);
      });
    return () => {
      alive = false;
    };
  }, [isConfigured, status, user, userId]);

  const setMode = useCallback(
    (m: GameMode) => {
      if (user?.is_anonymous && m === "real") {
        appToast.raw.error("익명 계정은 리얼 모드를 사용할 수 없습니다");
        return;
      }
      const applyLocal = () => {
        setModeState(m);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(modeStorageKey(userId), m);
        }
      };
      if (!isConfigured) {
        applyLocal();
        return;
      }
      if (status !== "authenticated" || !user) {
        if (m === "real") {
          appToast.raw.error("리얼 모드는 로그인이 필요합니다");
          return;
        }
        applyLocal();
        return;
      }
      if (user.is_anonymous) {
        applyLocal();
        return;
      }
      void setPreferredMode(m)
        .then(() => applyLocal())
        .catch((err: unknown) => {
          const message =
            err && typeof err === "object" && "message" in err
              ? preferredModeErrorMessage(err as { message?: string })
              : "모드를 변경할 수 없습니다. 잠시 후 다시 시도해 주세요.";
          appToast.raw.error(message);
        });
    },
    [isConfigured, status, user, userId],
  );

  const toggle = useCallback(() => {
    setMode(mode === "demo" ? "real" : "demo");
  }, [mode, setMode]);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      setMode,
      toggle,
      rtpLabel: mode === "demo" ? "데모 · RTP 99%" : "리얼 · RTP 99%",
      applyEdge: (raw: number) => raw * RTP[mode],
      modeReady,
    }),
    [mode, setMode, toggle, modeReady],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    return {
      mode: "demo",
      setMode: () => {},
      toggle: () => {},
      rtpLabel: "데모 · RTP 99%",
      applyEdge: (raw) => raw * RTP.demo,
      modeReady: true,
    };
  }
  return ctx;
}
