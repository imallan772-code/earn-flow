import { useEffect, type ReactNode } from "react";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import {
  useGameLayoutContext,
  type GameLayoutContextValue,
  type MainMode,
} from "./gameLayoutContext";

export type { GameLayoutContextValue, MainMode };

export function useGameLayout(): GameLayoutContextValue {
  return useGameLayoutContext();
}

/** DesktopShell main 폭 모드. 언마운트 시 `mobile` 복귀. */
export function useRegisterMainMode(mode: MainMode): void {
  const { setMainMode } = useGameLayoutContext();

  useEffect(() => {
    setMainMode(mode);
    return () => setMainMode("mobile");
  }, [mode, setMainMode]);
}

/** RightRail 등록. node는 useMemo로 안정화 권장 (LAYOUT-L). */
export function useRegisterRightRail(node: ReactNode | null): void {
  const isDesktop = useDesktopLayout();
  const { setRightRail } = useGameLayoutContext();

  useEffect(() => {
    if (!isDesktop) {
      setRightRail(null);
      return;
    }
    setRightRail(node);
    return () => setRightRail(null);
  }, [isDesktop, node, setRightRail]);
}
