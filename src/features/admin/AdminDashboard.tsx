import { Users, TrendingUp, Coins, Target, LayoutDashboard, Wallet, Settings } from "lucide-react";
import { CountUp } from "@/shared/motion/CountUp";

const KPIS = [
  { label: "오늘 가입", value: 8_482, delta: "+12.4%", Icon: Users, color: "var(--color-cyan)" },
  {
    label: "총 유저",
    value: 10_124_893,
    delta: "+0.8%",
    Icon: TrendingUp,
    color: "var(--color-purple)",
  },
  {
    label: "오늘 지급 PHON",
    value: 1_240_000_000,
    delta: "+34.2%",
    Icon: Coins,
    color: "var(--color-gold)",
  },
  {
    label: "오늘 미션 완료",
    value: 248_902,
    delta: "+18.1%",
    Icon: Target,
    color: "var(--color-pink)",
  },
];

export function AdminDashboard() {
  return (
    <div className="min-h-dvh bg-cosmic text-[var(--color-foreground)]">
      <div className="flex">
        {/* Sidebar */}
        <aside className="glass-2 hidden min-h-dvh w-60 flex-col gap-1 p-4 md:flex">
          <div className="mb-4 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-holographic">
              <LayoutDashboard size={16} className="text-[var(--color-bg-0)]" />
            </div>
            <span className="text-sm font-extrabold">PHONARA Admin</span>
          </div>
          {[
            { label: "Dashboard", Icon: LayoutDashboard, active: true },
            { label: "Users", Icon: Users },
            { label: "Economy", Icon: Coins },
            { label: "Withdrawals", Icon: Wallet },
            { label: "Settings", Icon: Settings },
          ].map((it) => (
            <button
              key={it.label}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${it.active ? "bg-white/8 font-semibold" : "text-[var(--color-muted)] hover:bg-white/5"}`}
            >
              <it.Icon size={16} />
              {it.label}
            </button>
          ))}
        </aside>

        {/* Main */}
        <main className="flex-1 p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold">대시보드</h1>
            <p className="text-sm text-[var(--color-muted)]">실시간 KPI · 1인 운영 콘솔 (mock)</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {KPIS.map((k) => (
              <div key={k.label} className="glass-3 rounded-3xl p-5 shadow-depth-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-[var(--color-muted)]">{k.label}</div>
                  <k.Icon size={18} style={{ color: k.color }} />
                </div>
                <div className="mt-2">
                  <CountUp value={k.value} className="font-numeric text-3xl font-extrabold" />
                </div>
                <div
                  className="mt-1 text-xs font-semibold"
                  style={{ color: "var(--color-emerald)" }}
                >
                  {k.delta} vs 어제
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="glass-3 rounded-3xl p-5 shadow-depth-2">
              <div className="text-sm font-semibold">최근 출금 큐 (mock)</div>
              <div className="mt-3 space-y-2 text-xs">
                {["김** · 1,240,000 KRW", "박** · 480 USDT", "이** · 8,400,000 PHON"].map((r) => (
                  <div
                    key={r}
                    className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2"
                  >
                    <span>{r}</span>
                    <span className="text-[var(--color-emerald)]">승인됨</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-3 rounded-3xl p-5 shadow-depth-2">
              <div className="text-sm font-semibold">어뷰징 알림</div>
              <div className="mt-3 text-xs text-[var(--color-muted)]">
                최근 24시간 이슈 없음 · 시스템 정상
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
