import type { ReactNode } from "react";
import { FloatingOrbs } from "./FloatingOrbs";

export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-cosmic">
      <FloatingOrbs />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-8 safe-top safe-bottom">
        {children}
      </div>
    </div>
  );
}
