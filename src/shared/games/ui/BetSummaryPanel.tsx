/**
 * BetSummaryPanel — universal "at-a-glance" panel showing bet amount,
 * target multiplier, and expected/live profit. Works in two modes:
 *
 *  - "static": pre-bet input preview. Recomputes on amount/target/mode change.
 *  - "live"  : during an active Crash round. Subscribes to a multiplier
 *               source and animates current payout per RAF.
 *
 * Used by Crash + Dice + future games. House edge baked in via useMode.
 */
import { useEffect, useState } from "react";
import { TrendingUp, Zap } from "lucide-react";
import { useMode } from "@/shared/mode/ModeContext";
import { applyEdge } from "@/shared/games/engine/houseEdge";
import { sharedTickLoop } from "@/shared/games/engine/tickLoop";
import { cn } from "@/lib/utils";

interface StaticProps {
  variant: "static";
  amount: number;
  /** Target/projected multiplier (e.g. auto-cashout or dice payout). */
  targetMultiplier: number;
  /** Optional win chance % (Dice). Omit for Crash. */
  winChancePct?: number;
}

interface LiveProps {
  variant: "live";
  amount: number;
  /** Auto-cashout target the user set. */
  targetMultiplier: number;
  /** Function returning the current live multiplier each frame. */
  getCurrentMultiplier: () => number;
  /** Crash-only: bust state to flash the panel. */
  busted?: boolean;
  /** Optional cashout handler — renders a fast-action button. */
  onCashout?: () => void;
  /** If user already cashed out, show locked-in value here. */
  cashedAt?: number | null;
}

type Props = StaticProps | LiveProps;

export function BetSummaryPanel(props: Props) {
  const { mode, rtpLabel } = useMode();

  if (props.variant === "static") {
    return <StaticPanel {...props} mode={mode} rtpLabel={rtpLabel} />;
  }
  return <LivePanel {...props} mode={mode} rtpLabel={rtpLabel} />;
}

function StaticPanel({
  amount,
  targetMultiplier,
  winChancePct,
  mode,
  rtpLabel,
}: StaticProps & { mode: "demo" | "real"; rtpLabel: string }) {
  const effectiveMult = applyEdge(targetMultiplier, mode);
  const expectedProfit = amount * (effectiveMult - 1);
  const maxLoss = amount;

  // win-chance color: high = cyan, mid = gold, low = rose
  const chance = winChancePct ?? Math.min(99, 100 / Math.max(1.01, targetMultiplier));
  const chanceColor =
    chance >= 50 ? "var(--color-cyan)" : chance >= 25 ? "var(--color-gold)" : "var(--color-rose)";

  const barPct = Math.min(100, (Math.log(Math.max(1.01, targetMultiplier)) / Math.log(10)) * 100);

  return (
    <div className="glass-2 flex flex-col gap-2.5 rounded-2xl p-3.5">
      <div className="grid grid-cols-3 gap-2">
        <Cell
          icon="💰"
          label="베팅액"
          value={`${amount.toFixed(2)}`}
          unit="USDT"
          color="var(--color-foreground)"
        />
        <Cell
          icon="🎯"
          label={winChancePct != null ? "당첨 확률" : "목표 배수"}
          value={winChancePct != null ? `${chance.toFixed(2)}%` : `${targetMultiplier.toFixed(2)}x`}
          color={chanceColor}
        />
        <Cell
          icon="💎"
          label="예상 수익"
          value={`${expectedProfit >= 0 ? "+" : ""}${expectedProfit.toFixed(2)}`}
          unit="USDT"
          color={expectedProfit >= 0 ? "var(--color-emerald)" : "var(--color-rose)"}
          emphasize
        />
      </div>

      {/* multiplier bar */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-(--color-bg-0)">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{
            width: `${barPct}%`,
            background: `linear-gradient(90deg, var(--color-cyan), var(--color-purple))`,
          }}
        />
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-2">
          배당{" "}
          <span className="font-numeric font-bold text-(--color-foreground)">
            {effectiveMult.toFixed(2)}x
          </span>
          <span
            className="ml-1.5 rounded-sm px-1.5 py-0.5"
            style={{
              background: `color-mix(in oklab, var(--color-${mode === "demo" ? "cyan" : "gold"}) 18%, transparent)`,
              color: `var(--color-${mode === "demo" ? "cyan" : "gold"})`,
            }}
          >
            {rtpLabel}
          </span>
        </span>
        <span className="font-numeric text-(--color-rose)">최대 손실 -{maxLoss.toFixed(2)}</span>
      </div>
    </div>
  );
}

function LivePanel({
  amount,
  targetMultiplier,
  getCurrentMultiplier,
  busted,
  onCashout,
  cashedAt,
  mode,
  rtpLabel,
}: LiveProps & { mode: "demo" | "real"; rtpLabel: string }) {
  const [liveM, setLiveM] = useState(1.0);

  useEffect(() => {
    const loop = sharedTickLoop();
    const unsub = loop.subscribe(() => {
      const m = getCurrentMultiplier();
      setLiveM((prev) => (Math.abs(prev - m) > 0.001 ? m : prev));
    });
    return () => unsub();
  }, [getCurrentMultiplier]);

  const effectiveLive = applyEdge(liveM, mode);
  const livePayout = amount * effectiveLive;
  const liveProfit = livePayout - amount;
  const targetPct = Math.min(100, (liveM / Math.max(targetMultiplier, 1.01)) * 100);
  const reached = liveM >= targetMultiplier;

  if (cashedAt != null) {
    const lockedProfit = amount * (applyEdge(cashedAt, mode) - 1);
    return (
      <div className="glass-2 flex flex-col gap-2 rounded-2xl p-3.5 ring-2 ring-emerald">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald">
            ✓ 캐쉬아웃 완료
          </span>
          <span className="font-numeric text-xs text-(--color-muted)">
            @ {cashedAt.toFixed(2)}x
          </span>
        </div>
        <div className="font-numeric text-3xl font-extrabold text-emerald">
          +{lockedProfit.toFixed(2)} USDT
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "glass-2 flex flex-col gap-2.5 rounded-2xl p-3.5 transition-all",
        busted && "animate-crash-flash ring-2 ring-(--color-rose)",
        !busted && "ring-2 ring-(--color-cyan) shadow-glow-cyan",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-(--color-cyan)">
          <span className="inline-flex h-2 w-2 animate-phon-pulse rounded-full bg-emerald" />
          LIVE · 라운드 진행 중
        </span>
        <span className="text-[10px] text-(--color-muted)">
          내 베팅{" "}
          <span className="font-numeric font-bold text-(--color-foreground)">
            {amount.toFixed(2)}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
            현재 배수
          </div>
          <div
            className={cn(
              "font-numeric text-2xl font-extrabold tabular-nums",
              busted ? "text-(--color-rose)" : "text-(--color-foreground)",
            )}
          >
            {effectiveLive.toFixed(2)}x
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
            예상 수익
          </div>
          <div
            className={cn(
              "font-numeric text-2xl font-extrabold tabular-nums",
              busted ? "text-(--color-rose)" : "text-emerald",
            )}
          >
            {busted ? `-${amount.toFixed(2)}` : `+${liveProfit.toFixed(2)}`}
          </div>
        </div>
      </div>

      {/* target progress */}
      <div className="relative h-1.5 overflow-hidden rounded-full bg-(--color-bg-0)">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-100",
            reached
              ? "bg-emerald shadow-glow-cyan"
              : "bg-linear-to-r from-(--color-cyan) to-(--color-purple)",
          )}
          style={{ width: `${targetPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-2">
          목표{" "}
          <span className="font-numeric font-bold text-(--color-foreground)">
            {targetMultiplier.toFixed(2)}x
          </span>
          {reached && <span className="ml-1.5 text-emerald">✓ 도달</span>}
        </span>
        <span className="text-muted-2">{rtpLabel}</span>
      </div>

      {onCashout && !busted && (
        <button
          onClick={onCashout}
          className="mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-warning py-2.5 text-sm font-extrabold text-(--color-bg-0) shadow-glow-gold active:scale-[0.98]"
        >
          <Zap size={14} />
          캐쉬아웃 @ {effectiveLive.toFixed(2)}x
        </button>
      )}

      {busted && (
        <div className="rounded-lg bg-[color-mix(in_oklab,var(--color-rose)_18%,transparent)] px-3 py-2 text-center">
          <div className="text-[10px] font-bold uppercase tracking-wider text-(--color-rose)">
            <TrendingUp size={10} className="inline" /> 라운드 종료
          </div>
          <div className="font-numeric mt-0.5 text-base font-extrabold text-(--color-rose)">
            -{amount.toFixed(2)} USDT
          </div>
        </div>
      )}
    </div>
  );
}

function Cell({
  icon,
  label,
  value,
  unit,
  color,
  emphasize,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  color: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl bg-(--color-bg-0) px-2 py-1.5">
      <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
        <span aria-hidden>{icon}</span>
        {label}
      </div>
      <div
        className={cn(
          "font-numeric font-extrabold tabular-nums leading-tight",
          emphasize ? "text-base" : "text-sm",
        )}
        style={{ color }}
      >
        {value}
        {unit && <span className="ml-1 text-[9px] font-bold text-muted-2">{unit}</span>}
      </div>
    </div>
  );
}
