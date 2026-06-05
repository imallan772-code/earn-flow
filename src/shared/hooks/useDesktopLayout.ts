/**
 * useDesktopLayout — 앱 셸·게임 레이아웃 분기 SSOT (1024px).
 *
 * shadcn Sidebar 내부 `useIsMobile` (768) 과 분리:
 *  - 768: Sidebar Sheet vs collapse (ui/sidebar.tsx 전용)
 *  - 1024: MobileShell vs DesktopShell (본 훅)
 */
import { useEffect, useState } from "react";

export const DESKTOP_LAYOUT_MIN_WIDTH = 1024;

export const DESKTOP_LAYOUT_MEDIA_QUERY = `(min-width: ${DESKTOP_LAYOUT_MIN_WIDTH}px)`;

export function useDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_LAYOUT_MEDIA_QUERY);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return isDesktop;
}
