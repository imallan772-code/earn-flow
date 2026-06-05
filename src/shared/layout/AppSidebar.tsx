/**
 * AppSidebar — 데스크탑 좌측 nav (≥1024). grid/flex 1열 고정 (fixed Sidebar 금지).
 */
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { APP_NAV_ITEMS } from "./appNav";
import { t } from "@/shared/i18n";

export function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside
      className="glass-2 sticky top-0 z-20 hidden h-dvh w-(--sidebar-width) shrink-0 flex-col border-r border-(--color-border) lg:flex safe-top safe-bottom"
      aria-label="앱 메뉴"
    >
      <header className="border-b border-(--color-border) px-4 py-4">
        <Link to="/earn" className="block">
          <span className="text-lg font-extrabold tracking-tight text-(--color-cyan)">PHONARA</span>
        </Link>
        <p className="type-caption mt-1">Earn · Play · Trade</p>
      </header>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {APP_NAV_ITEMS.map((item) => {
          const active = item.match(path);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-[color-mix(in_oklab,var(--color-cyan)_14%,transparent)] text-(--color-cyan)"
                  : "text-(--color-muted) hover:bg-(--color-surface-hi) hover:text-(--color-foreground)",
              )}
            >
              <item.Icon size={18} strokeWidth={active ? 2.4 : 2} />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
      <footer className="type-caption border-t border-(--color-border) p-4">
        Demo mode · RTP 97%
      </footer>
    </aside>
  );
}
