import { Link, useRouterState } from "@tanstack/react-router";
import { m } from "framer-motion";
import { cn } from "@/lib/utils";
import { springSnappy } from "../motion/springs";
import { t } from "@/shared/i18n";
import { APP_NAV_ITEMS } from "./appNav";

export function BottomNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="z-40 mx-auto w-full max-w-md safe-bottom">
      <div className="glass-3 mx-3 mb-3 flex items-center justify-around rounded-3xl px-2 py-2 shadow-depth-3">
        {APP_NAV_ITEMS.map((it) => {
          const active = it.match(path);
          return (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "relative flex min-h-[44px] min-w-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-xs",
                active ? "text-(--color-cyan)" : "text-(--color-muted)",
              )}
            >
              {active && (
                <m.span
                  layoutId="botnav-pill"
                  className="absolute inset-0 rounded-2xl ring-aurora-live"
                  style={{ background: "color-mix(in oklab, var(--color-cyan) 12%, transparent)" }}
                  transition={springSnappy}
                />
              )}
              <m.span
                animate={{ scale: active ? 1.12 : 1 }}
                transition={springSnappy}
                className="relative z-10"
              >
                <it.Icon size={22} strokeWidth={active ? 2.4 : 2} />
              </m.span>
              <span className="relative z-10 font-medium">{t(it.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
