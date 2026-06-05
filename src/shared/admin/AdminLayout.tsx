/**
 * AdminLayout — desktop 운영 셸 (순수 레이아웃, 비즈 로직 0).
 * web /admin 라우트와 apps/admin standalone 모두 재사용.
 */
import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_NAV, ADMIN_SHELL_META, type AdminNavId } from "@/shared/admin/nav";

export function AdminLayout({ active, children }: { active: AdminNavId; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-cosmic text-(--color-foreground)">
      <div className="flex">
        <aside className="glass-2 hidden min-h-dvh w-60 flex-col gap-1 p-4 md:flex">
          <div className="mb-4 px-2">
            <div className="text-sm font-extrabold">{ADMIN_SHELL_META.title}</div>
            <div className="text-[11px] text-(--color-muted)">{ADMIN_SHELL_META.subtitle}</div>
          </div>
          {ADMIN_NAV.map((item) => (
            <Link
              key={item.id}
              to={item.to}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition",
                active === item.id
                  ? "bg-white/8 font-semibold"
                  : "text-(--color-muted) hover:bg-white/5",
              )}
            >
              <item.Icon size={16} />
              {item.label}
            </Link>
          ))}
          <Link
            to={ADMIN_SHELL_META.webAppLink}
            className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-(--color-muted) hover:bg-white/5"
          >
            <ExternalLink size={14} />
            사용자 앱
          </Link>
        </aside>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
