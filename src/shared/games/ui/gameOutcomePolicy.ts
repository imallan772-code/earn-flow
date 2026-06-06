/**
 * Stake-like game outcome UX — SSOT for all games.
 *
 * - Win / loss / cashout: in-game RoundResultCard (or inline display) ONLY
 * - Bet placed: SFX only — no toast
 * - PF seed change: single info toast via notifyPfSeedChanged()
 * - Money / network errors: appToast.raw.error only
 * - RoundResultCard: after main reveal animation (useRoundResultFlash)
 */
import { useEffect, useState } from "react";
import { appToast } from "@/shared/ui/toast";

export function notifyPfSeedChanged(): void {
  appToast.raw.info("시드 변경됨 · nonce 0 리셋", { duration: 2000 });
}

/** Limbo count-up duration (LimboDisplay) + rolling window offset. */
export const LIMBO_RESULT_FLASH_DELAY_MS = 1500;
/** Mines — tile flip / shake before P/L flash. */
export const MINES_RESULT_FLASH_DELAY_MS = 450;

/**
 * Delays RoundResultCard until the primary result UI finishes (Stake-like).
 * Pass pending outcome when settled; returns null until delayMs elapsed.
 */
export function useRoundResultFlash<T>(pending: T | null, delayMs: number): T | null {
  const [flash, setFlash] = useState<T | null>(null);

  useEffect(() => {
    if (!pending) {
      setFlash(null);
      return;
    }
    if (delayMs <= 0) {
      setFlash(pending);
      return;
    }
    setFlash(null);
    const t = window.setTimeout(() => setFlash(pending), delayMs);
    return () => window.clearTimeout(t);
  }, [pending, delayMs]);

  return flash;
}
