export const springSoft = { type: "spring" as const, stiffness: 180, damping: 22 };
export const springSnappy = { type: "spring" as const, stiffness: 380, damping: 28 };
export const pageTransition = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] },
};
