import { Link, useRouterState } from "@tanstack/react-router";
import { Zap, Gamepad2, TrendingUp, User, Bell, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { springSnappy } from "../motion/springs";

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  match: (p: string) => boolean;
}

const ITEMS: NavItem[] = [
  { to: "/feed", label: "Pulse", Icon: Zap, match: (p) => p === "/feed" },
  { to: "/earn", label: "Earn", Icon: Gamepad2, match: (p) => p.startsWith("/earn") },
  { to: "/exchange/BTCUSDT", label: "Trade", Icon: TrendingUp, match: (p) => p.startsWith("/exchange") },
  { to: "/notice", label: "Notice", Icon: Bell, match: (p) => p.startsWith("/notice") || p.startsWith("/event") },
  { to: "/my", label: "My", Icon: User, match: (p) => p === "/my" },
];

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="sticky bottom-0 z-40 mx-auto w-full max-w-md safe-bottom">
      <div className="glass-3 mx-3 mb-3 flex items-center justify-around rounded-3xl px-2 py-2 shadow-depth-3">
        {ITEMS.map((it) => {
          const active = it.match(path);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-xs",
                active ? "text-[var(--color-cyan)]" : "text-[var(--color-muted)]"
              )}
            >
              {active && (
                <motion.span
                  layoutId="botnav-pill"
                  className="absolute inset-0 rounded-2xl ring-aurora-live"
                  style={{ background: "color-mix(in oklab, var(--color-cyan) 12%, transparent)" }}
                  transition={springSnappy}
                />
              )}
              <motion.span
                animate={{ scale: active ? 1.12 : 1 }}
                transition={springSnappy}
                className="relative z-10"
              >
                <it.Icon size={22} strokeWidth={active ? 2.4 : 2} />
              </motion.span>
              <span className="relative z-10 font-medium">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
