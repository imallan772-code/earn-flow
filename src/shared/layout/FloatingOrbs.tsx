import { m, useReducedMotion } from "framer-motion";

export function FloatingOrbs() {
  const reduced = useReducedMotion();
  // Skip the orbs entirely when motion is reduced — they're decorative.
  if (reduced) {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl"
          style={{ background: "color-mix(in oklab, var(--color-purple) 30%, transparent)" }}
        />
        <div
          className="absolute -right-20 top-32 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "color-mix(in oklab, var(--color-cyan) 25%, transparent)" }}
        />
      </div>
    );
  }
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <m.div
        className="absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl"
        style={{
          background: "color-mix(in oklab, var(--color-purple) 40%, transparent)",
          willChange: "transform",
        }}
        animate={{ y: [0, 20, 0], x: [0, 10, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <m.div
        className="absolute -right-20 top-32 h-64 w-64 rounded-full blur-3xl"
        style={{
          background: "color-mix(in oklab, var(--color-cyan) 35%, transparent)",
          willChange: "transform",
        }}
        animate={{ y: [0, -16, 0], x: [0, -8, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />
      <m.div
        className="absolute bottom-0 left-1/3 h-80 w-80 rounded-full blur-3xl"
        style={{
          background: "color-mix(in oklab, var(--color-pink) 30%, transparent)",
          willChange: "transform",
        }}
        animate={{ y: [0, 22, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
