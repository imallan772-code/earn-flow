import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { ADMIN_KO } from "@/shared/admin/labels.ko";
import { usePromoAiStatus } from "../hooks/usePromoAiStatus";
import { promoAiProviderLabelKo } from "../lib/promoAiLabel";
import {
  Wand2,
  ListChecks,
  CalendarDays,
  Radio,
  Image as ImageIcon,
  BarChart3,
  Settings,
} from "lucide-react";

const TABS = [
  { to: "/admin/promo/studio", label: ADMIN_KO.promo.tabs.studio, Icon: Wand2 },
  { to: "/admin/promo/campaigns", label: ADMIN_KO.promo.tabs.campaigns, Icon: ListChecks },
  { to: "/admin/promo/calendar", label: ADMIN_KO.promo.tabs.calendar, Icon: CalendarDays },
  { to: "/admin/promo/channels", label: ADMIN_KO.promo.tabs.channels, Icon: Radio },
  { to: "/admin/promo/assets", label: ADMIN_KO.promo.tabs.assets, Icon: ImageIcon },
  { to: "/admin/promo/analytics", label: ADMIN_KO.promo.tabs.analytics, Icon: BarChart3 },
  { to: "/admin/promo/settings", label: ADMIN_KO.promo.tabs.settings, Icon: Settings },
] as const;

export function PromoShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const status = usePromoAiStatus();
  const koAi = ADMIN_KO.promo.ai;
  const subtitle = status.loading
    ? ADMIN_KO.promo.subtitle
    : status.configured
      ? koAi.subtitleConfigured(promoAiProviderLabelKo(status.provider))
      : koAi.subtitleFallback;
  return (
    <div className="min-h-dvh bg-cosmic text-(--color-foreground)">
      <header className="glass-2 sticky top-0 z-30 border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold">{ADMIN_KO.promo.title}</div>
            <div className="text-[11px] text-(--color-muted)">{subtitle}</div>
          </div>
          <Link
            to="/admin"
            className="rounded-xl px-3 py-1.5 text-xs text-(--color-muted) hover:bg-white/5"
          >
            {ADMIN_KO.shell.backToAdmin}
          </Link>
        </div>
        <nav className="mt-3 flex gap-1 overflow-x-auto">
          {TABS.map(({ to, label, Icon }) => {
            const active =
              pathname === to || (to === "/admin/promo/studio" && pathname === "/admin/promo");
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs transition",
                  active ? "bg-white/10 font-semibold" : "text-(--color-muted) hover:bg-white/5",
                )}
              >
                <Icon size={13} />
                {label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl p-4 md:p-6">{children}</main>
    </div>
  );
}
