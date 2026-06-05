import { useCallback, useEffect, useMemo } from "react";
import { playSfx, setSfxEnabled, setSfxVolume, type SfxId } from "./SfxEngine";
import { sfxStore } from "@/shared/games/state/persistedGameState";

export function useSfx() {
  const enabled = sfxStore.use((s) => s.enabled);
  const volume = sfxStore.use((s) => s.volume);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      if (mq.matches) setSfxEnabled(false);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const play = useCallback((id: SfxId) => playSfx(id), []);
  const toggleMute = useCallback(() => setSfxEnabled(!sfxStore.get().enabled), []);
  const setVolume = useCallback((v: number) => setSfxVolume(v), []);

  return useMemo(
    () => ({ enabled, volume, play, toggleMute, setVolume }),
    [enabled, volume, play, toggleMute, setVolume],
  );
}
