/**
 * useGameViewport — 중앙 main 가용 영역 px (ResizeObserver).
 * LAYOUT-L: Wheel 디스플레이 max width / sidebar collapse 대응.
 */
import { useEffect, useState } from "react";
import { useGameViewportRef } from "./gameViewportContext";

export interface GameViewportSize {
  width: number;
  height: number;
}

export function useGameViewport(): GameViewportSize {
  const viewportRef = useGameViewportRef();
  const [size, setSize] = useState<GameViewportSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = viewportRef?.current;
    if (!el) return;

    const sync = () => {
      const { width, height } = el.getBoundingClientRect();
      setSize({ width, height });
    };

    sync();
    const ro = new ResizeObserver(() => sync());
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewportRef]);

  return size;
}
