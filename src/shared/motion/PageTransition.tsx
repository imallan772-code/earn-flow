import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import { pageTransition } from "./springs";

export function PageTransition({ keyId, children }: { keyId: string; children: ReactNode }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={keyId} {...pageTransition}>
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
