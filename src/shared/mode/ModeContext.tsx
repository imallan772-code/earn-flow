/**
 * Global Demo / Real mode context.
 *
 * - One toggle at the home top governs every game and trade screen.
 * - Demo: 100% RTP (no house edge), virtual balance (defaults to 1,000,000).
 * - Real: 97% RTP (3% house edge applied to payout multiplier), real balance.
 *
 * Provably-fair engines are NOT touched — only the payout multiplier
 * displayed and settled to the user is multiplied by `RTP[mode]`.
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

export type GameMode = "demo" | "real";

export const RTP: Record<GameMode, number> = {
  demo: 1.0,
  real: 0.97,
};

interface ModeContextValue {
  mode: GameMode;
  setMode: (m: GameMode) => void;
  toggle: () => void;
  /** Display label */
  rtpLabel: string;
  /** Apply current mode's RTP to a raw multiplier */
  applyEdge: (rawMultiplier: number) => number;
}

const ModeContext = createContext<ModeContextValue | null>(null);
const STORAGE_KEY = "phonara.mode";

export function ModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<GameMode>("demo");

  // hydrate from localStorage post-mount (SSR-safe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "demo" || stored === "real") setModeState(stored);
  }, []);

  const setMode = useCallback((m: GameMode) => {
    setModeState(m);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, m);
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(mode === "demo" ? "real" : "demo");
  }, [mode, setMode]);

  const value = useMemo<ModeContextValue>(
    () => ({
      mode,
      setMode,
      toggle,
      rtpLabel: mode === "demo" ? "데모 100% RTP" : "리얼 97% RTP",
      applyEdge: (raw: number) => raw * RTP[mode],
    }),
    [mode, setMode, toggle],
  );

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
}

export function useMode(): ModeContextValue {
  const ctx = useContext(ModeContext);
  if (!ctx) {
    // graceful fallback for SSR / outside provider — defaults to demo
    return {
      mode: "demo",
      setMode: () => {},
      toggle: () => {},
      rtpLabel: "데모 100% RTP",
      applyEdge: (raw) => raw,
    };
  }
  return ctx;
}
