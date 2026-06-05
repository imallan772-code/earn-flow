/**
 * OutOfDemoModal — globally mounted; shown when demo balance is insufficient
 * for an attempted bet. Pushes the user to switch to Real mode + deposit.
 */
import { useNavigate } from "@tanstack/react-router";
import { X, TrendingUp, Sparkles } from "lucide-react";
import {
  closeOutOfDemoModal,
  useOutOfDemoModal,
  useWalletStats,
  INITIAL_DEMO_GRANT,
} from "./walletStore";
import { useMode } from "@/shared/mode/ModeContext";

export function OutOfDemoModal() {
  const { open } = useOutOfDemoModal();
  const stats = useWalletStats();
  const { setMode } = useMode();
  const navigate = useNavigate();

  if (!open) return null;

  const handleSwitch = () => {
    setMode("real");
    closeOutOfDemoModal();
    navigate({ to: "/deposit" }).catch(() => {
      // route may not exist in all builds; fall back silently
    });
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={closeOutOfDemoModal}
    >
      <div
        className="glass-2 w-full max-w-md rounded-t-3xl p-5 pb-8 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-full bg-[color-mix(in_oklab,var(--color-gold)_22%,transparent)]">
              <Sparkles size={16} className="text-[var(--color-gold)]" />
            </span>
            <h2 className="text-lg font-extrabold">체험 크레딧 종료</h2>
          </div>
          <button onClick={closeOutOfDemoModal} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <p className="mb-4 text-sm leading-relaxed text-[var(--color-muted)]">
          데모는 1회성 체험판입니다. 잔액은 추가 지급되지 않아요.
          <br />
          리얼 모드에서는 실제 입금/출금이 가능하고 같은 RTP(97%)로 진행됩니다.
        </p>

        {/* Stats */}
        <div className="mb-5 grid grid-cols-3 gap-2">
          <Stat label="총 베팅" value={`${stats.totalBets}회`} />
          <Stat
            label="최고 배율"
            value={stats.maxMultiplier > 0 ? `${stats.maxMultiplier.toFixed(2)}x` : "—"}
          />
          <Stat
            label="순손익"
            value={`${stats.netResult >= 0 ? "+" : ""}${stats.netResult.toFixed(0)}`}
            tone={stats.netResult >= 0 ? "win" : "loss"}
          />
        </div>

        <div className="mb-3 rounded-xl border border-[color-mix(in_oklab,var(--color-gold)_30%,transparent)] bg-[color-mix(in_oklab,var(--color-gold)_8%,transparent)] p-3 text-center">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-gold)]">
            첫 입금 보너스
          </div>
          <div className="font-numeric text-xl font-extrabold text-[var(--color-gold)]">+100%</div>
          <div className="text-[10px] text-[var(--color-muted-2)]">최대 200,000원까지 매칭</div>
        </div>

        <button
          onClick={handleSwitch}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-gold)] py-3.5 text-sm font-extrabold text-[var(--color-bg-0)] shadow-glow-gold transition active:scale-[0.98]"
        >
          <TrendingUp size={16} />
          리얼 모드로 전환하기
        </button>

        <p className="mt-3 text-center text-[10px] text-[var(--color-muted-2)]">
          체험 크레딧: {INITIAL_DEMO_GRANT.toLocaleString()}원 (1회 지급)
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "win" | "loss" }) {
  const color =
    tone === "win"
      ? "var(--color-emerald)"
      : tone === "loss"
        ? "var(--color-rose)"
        : "var(--color-foreground)";
  return (
    <div className="glass-1 rounded-xl p-2.5 text-center">
      <div className="text-[10px] text-[var(--color-muted-2)]">{label}</div>
      <div className="font-numeric text-sm font-extrabold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
