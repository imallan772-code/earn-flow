import { AnimatePresence, motion } from "framer-motion";

interface Props {
  amount: number | null;
  onDone?: () => void;
}

export function FloatingReward({ amount }: Props) {
  return (
    <AnimatePresence>
      {amount != null && (
        <motion.div
          key={amount + "-" + Math.random()}
          className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center"
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: -40, scale: 1 }}
          exit={{ opacity: 0, y: -80, scale: 0.95 }}
          transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <div className="font-numeric text-5xl font-extrabold text-holographic drop-shadow-[0_0_24px_rgba(168,85,247,0.6)]">
            +{new Intl.NumberFormat("ko-KR").format(amount)} PHON
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
