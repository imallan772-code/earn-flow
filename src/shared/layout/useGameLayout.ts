import { useEffect, type ReactNode } from "react";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { useGameLayoutContext, type GameLayoutContextValue } from "./gameLayoutContext";

export type { GameLayoutContextValue };

export function useGameLayout(): GameLayoutContextValue {
  return useGameLayoutContext();
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
