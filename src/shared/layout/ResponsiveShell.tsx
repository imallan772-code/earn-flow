/**
 * ResponsiveShell — P-0 앱 셸 진입점. Mobile + Desktop 단일 children 트리.
 */
import type { ReactNode } from "react";
import { DesktopShell } from "./DesktopShell";

export function ResponsiveShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-cosmic">
      <DesktopShell>{children}</DesktopShell>
    </div>
  );
}
