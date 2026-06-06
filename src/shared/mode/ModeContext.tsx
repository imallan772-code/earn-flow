/**
 * Global Demo / Real mode context.
 *
 * - Per-account mode preference (guest vs userId).
 * - Demo: 1회성 체험 크레딧 (₩10,000), 리얼과 동일 RTP 97%.
 * - Real: Supabase PHON via RPC.
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

export type GameMode = "demo" | "real";

export const RTP: Record<GameMode, number> = {
  demo: 0.97,
  real: 0.97,
};

interface ModeContextValue {
  mode: GameMode;
  setMode: (m: GameMode) => void;
  toggle: () => void;
  rtpLabel: string;
  applyEdge: (rawMultiplier: number) => number;
}

const ModeContext = createContext<ModeContextValue | null>(null);

function modeStorageKey(userId: string | null | undefined): string {
  return userId ? `phonara.mode.${userId}` : "phonara.mode.guest";
}

export function ModeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [mode, setModeState] = useState<GameMode>("demo");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(modeStorageKey(userId));
    if (stored === "demo" || stored === "real") {
      setModeState(stored);
    } else {
      setModeState("demo");
    }
  }, [userId]);

  const setMode = useCallback(
    (m: GameMode) => {
      setModeState(m);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(modeStorageKey(userId), m);
      }
    },
    [userId],
  );

  const toggle = useCallback(() => {
    setMode(mode === "demo" ? "real" : "demo");
  }, [mode, setMode]);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      setMode,
      toggle,
      rtpLabel: mode === "demo" ? "데모 · RTP 97%" : "리얼 · RTP 97%",
      applyEdge: (raw: number) => raw * RTP[mode],
    }),
    [mode, setMode, toggle],
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
      rtpLabel: "데모 · RTP 97%",
      applyEdge: (raw) => raw * RTP.demo,
    };
  }
  return ctx;
}
