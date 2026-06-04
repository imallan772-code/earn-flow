/**
 * Global Demo / Real mode context.
 *
 * - One toggle at the home top governs every game and trade screen.
 * - Demo: 1회성 체험 크레딧 (₩10,000), 리얼과 동일 RTP 97%.
 * - Real: 실제 입금/출금. RTP 97% (3% house edge applied to payout multiplier).
 *
 * RTP는 데모/리얼 동일 — 데모가 잘 터지면 리얼 전환 후 이탈 위험이 커지므로
 * 결과 편향은 도입하지 않는다(Stake/Roobet과 동일 방침).
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
  demo: 0.97,
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
