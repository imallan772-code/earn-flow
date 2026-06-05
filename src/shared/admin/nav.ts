import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Megaphone, Trophy, ExternalLink } from "lucide-react";

export type AdminNavId = "dashboard" | "notice" | "event";

export interface AdminNavItem {
  id: AdminNavId;
  label: string;
  to: "/admin" | "/admin/notice" | "/admin/event";
  Icon: LucideIcon;
}

export const ADMIN_NAV: AdminNavItem[] = [
  { id: "dashboard", label: "Dashboard", to: "/admin", Icon: LayoutDashboard },
  { id: "notice", label: "공지", to: "/admin/notice", Icon: Megaphone },
  { id: "event", label: "이벤트", to: "/admin/event", Icon: Trophy },
];

export const ADMIN_SHELL_META = {
  title: "PHONARA Admin",
  subtitle: "1인 운영 콘솔 · phonara-gb",
  webAppLink: "/feed",
} as const;
