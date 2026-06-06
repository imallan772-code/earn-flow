/**
 * AdminDashboard — real KPI from admin_dashboard_stats RPC (mock fallback offline).
 */
import { useQuery } from "@tanstack/react-query";
import { Users, TrendingUp, Megaphone, Trophy } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { CountUp } from "@/shared/motion/CountUp";
import { AdminLayout } from "@/shared/admin/AdminLayout";
import { fetchIsAdmin } from "@/lib/api/admin/auth";
import { adminDashboardStats } from "@/lib/api/admin/dashboard";
import { isSupabaseConfigured } from "@/integrations/supabase/env";

const MOCK_STATS = {
  total_users: 10_124_893,
  signups_today: 8_482,
  published_events: 3,
  published_notices: 6,
};

export function AdminDashboard() {
  const configured = isSupabaseConfigured();
  const { status } = useAuth();
  const adminMembership = useQuery({
    queryKey: ["admin", "membership"],
    queryFn: fetchIsAdmin,
    enabled: configured && status === "authenticated",
    retry: false,
    staleTime: 5 * 60_000,
  });
  const persisting =
    configured && status === "authenticated" && adminMembership.data === true;

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: adminDashboardStats,
    enabled: persisting,
    retry: false,
    staleTime: 30_000,
  });

  const stats = data ?? MOCK_STATS;

  const kpis = [
    {
      label: "오늘 가입",
      value: stats.signups_today,
      Icon: Users,
      color: "var(--color-cyan)",
    },
    {
      label: "총 유저",
      value: stats.total_users,
      Icon: TrendingUp,
      color: "var(--color-purple)",
    },
    {
      label: "게시 이벤트",
      value: stats.published_events,
      Icon: Trophy,
      color: "var(--color-gold)",
    },
    {
      label: "게시 공지",
      value: stats.published_notices,
      Icon: Megaphone,
      color: "var(--color-pink)",
    },
  ];

  return (
    <AdminLayout active="dashboard">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">대시보드</h1>
        <p className="text-sm text-(--color-muted)">
          {persisting
            ? isLoading
              ? "Supabase 집계 불러오는 중…"
              : "실시간 KPI"
            : configured
              ? "데모 KPI (admin_users 등록 후 실데이터)"
              : "오프라인 데모 KPI"}
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="glass-3 rounded-3xl p-5 shadow-depth-2">
            <div className="flex items-center justify-between">
              <div className="text-xs text-(--color-muted)">{k.label}</div>
              <k.Icon size={18} style={{ color: k.color }} />
            </div>
            <div className="mt-2">
              <CountUp value={k.value} className="font-numeric text-3xl font-extrabold" />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 glass-3 rounded-3xl p-5 shadow-depth-2">
        <div className="text-sm font-semibold">운영 안내</div>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-(--color-muted)">
          <li>공지·이벤트 CRUD는 Supabase admin RPC로 즉시 사용자 앱에 반영됩니다.</li>
          <li>
            최초 운영자 등록: Supabase SQL —{" "}
            <code className="rounded bg-white/5 px-1">
              INSERT INTO admin_users (user_id) VALUES (&apos;your-uuid&apos;);
            </code>
          </li>
          <li>도메인 분리 출시: `apps/admin` standalone 빌드 → admin.phonara.com</li>
        </ul>
      </div>
    </AdminLayout>
  );
}
