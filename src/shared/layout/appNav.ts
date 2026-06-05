import { Zap, Gamepad2, TrendingUp, User, Bell, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/shared/i18n";

export interface AppNavItem {
  to: string;
  labelKey: MessageKey;
  Icon: LucideIcon;
  match: (path: string) => boolean;
}

/** BottomNav + AppSidebar 공유 nav SSOT */
export const APP_NAV_ITEMS: readonly AppNavItem[] = [
  { to: "/feed", labelKey: "nav.feed", Icon: Zap, match: (p) => p === "/feed" },
  { to: "/earn", labelKey: "nav.earn", Icon: Gamepad2, match: (p) => p.startsWith("/earn") },
  {
    to: "/exchange/BTCUSDT",
    labelKey: "nav.trade",
    Icon: TrendingUp,
    match: (p) => p.startsWith("/exchange"),
  },
  {
    to: "/notice",
    labelKey: "nav.notice",
    Icon: Bell,
    match: (p) => p.startsWith("/notice") || p.startsWith("/event"),
  },
  { to: "/my", labelKey: "nav.my", Icon: User, match: (p) => p === "/my" },
] as const;
