import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MobileShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-dvh w-full bg-cosmic">
      <div className={cn("mx-auto flex min-h-dvh w-full max-w-md flex-col safe-top", className)}>
        {children}
      </div>
    </div>
  );
}
