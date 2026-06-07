/**
 * ResponsiveShell — P-0 앱 셸 진입점. Mobile + Desktop 단일 children 트리.
 */
import type { ReactNode } from "react";
import { AutoBetGlobalIndicator } from "@/shared/games/ui/AutoBetGlobalIndicator";
import { KillSwitchBanner } from "@/shared/games/ui/KillSwitchBanner";
import { DesktopShell } from "./DesktopShell";

export function ResponsiveShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-cosmic">
      <KillSwitchBanner />
      <AutoBetGlobalIndicator />
      <DesktopShell>{children}</DesktopShell>
    </div>
  );
}
