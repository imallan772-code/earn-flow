import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Megaphone, Trophy, Sparkles } from "lucide-react";
import { ADMIN_KO } from "@/shared/admin/labels.ko";

export type AdminNavId = "dashboard" | "notice" | "event" | "promo";

export interface AdminNavItem {
  id: AdminNavId;
  label: string;
  to: "/admin" | "/admin/notice" | "/admin/event" | "/admin/promo";
  Icon: LucideIcon;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "dashboard", label: ADMIN_KO.nav.dashboard, to: "/admin", Icon: LayoutDashboard },
  { id: "notice", label: ADMIN_KO.nav.notice, to: "/admin/notice", Icon: Megaphone },
  { id: "event", label: ADMIN_KO.nav.event, to: "/admin/event", Icon: Trophy },
  { id: "promo", label: ADMIN_KO.nav.promo, to: "/admin/promo", Icon: Sparkles },
];

export const ADMIN_SHELL_META = {
  title: ADMIN_KO.shell.title,
  subtitle: ADMIN_KO.shell.subtitle,
  webAppLink: "/feed",
} as const;
