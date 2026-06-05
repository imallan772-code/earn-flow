import { AnimatePresence, m } from "framer-motion";
import type { ReactNode } from "react";
import { pageTransition } from "./springs";

export function PageTransition({ keyId, children }: { keyId: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div key={keyId} {...pageTransition}>
        {children}
      </m.div>
    </AnimatePresence>
  );
}
