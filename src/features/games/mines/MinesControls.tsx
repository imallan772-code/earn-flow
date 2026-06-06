/**
 * MinesControls — 지뢰 수 stepper + 프리셋 칩 + 랜덤 버튼 + 캐쉬아웃 + 키보드 HUD.
 *
 * 디자인 결정
 *  - 본 컴포넌트는 순수 표시/콜백. 베팅·정산·store mutation 일체 없음.
 *  - playing 단계에서만 cashout/random 노출.
 *  - idle 단계에서만 stepper/preset 활성.
 */
import { Dice5, Zap } from "lucide-react";
import { MAX_MINES, MIN_MINES } from "@/shared/games/mines/MinesEngine";
import { cn } from "@/lib/utils";

const MINE_PRESETS = [1, 3, 5, 10, 24] as const;

interface Props {
  mineCount: number;
  onMineCountChange: (n: number) => void;
  isIdle: boolean;
  isPlaying: boolean;
  canCashout: boolean;
  currentMult: number;
  onCashout: () => void;
  onRandomPick: () => void;
}

export function MinesControls({
  mineCount,
  onMineCountChange,
  isIdle,
  isPlaying,
  canCashout,
  currentMult,
  onCashout,
  onRandomPick,
}: Props) {
  return (
    <div className="glass-2 flex flex-col gap-2 rounded-2xl p-3">
      <div className="flex items-center gap-2">
        <span className="type-label">지뢰 수</span>
        <button
          type="button"
          onClick={() => onMineCountChange(mineCount - 1)}
          disabled={!isIdle || mineCount <= MIN_MINES}
          className="rounded-lg bg-(--color-surface-hi) px-3 py-1.5 text-sm font-bold disabled:opacity-40"
        >
          −
        </button>
        <span className="font-numeric flex-1 text-center text-base font-extrabold text-(--color-rose)">
          {mineCount}
        </span>
        <button
          type="button"
          onClick={() => onMineCountChange(mineCount + 1)}
          disabled={!isIdle || mineCount >= MAX_MINES}
          className="rounded-lg bg-(--color-surface-hi) px-3 py-1.5 text-sm font-bold disabled:opacity-40"
        >
          +
        </button>
        {isPlaying && (
          <button
            type="button"
            onClick={onRandomPick}
            className="ml-1 flex items-center gap-1 rounded-lg bg-(--color-surface-hi) px-2.5 py-1.5 text-[11px] font-extrabold text-gold hover:bg-bg-2"
            aria-label="랜덤 안전 타일 1개 선택"
          >
            <Dice5 size={12} />
            랜덤
          </button>
        )}
      </div>

      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {MINE_PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onMineCountChange(p)}
            disabled={!isIdle}
            className={cn(
              "font-numeric shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition",
              mineCount === p
                ? "bg-warning text-(--color-bg-0) shadow-glow-gold ring-2 ring-gold"
                : "bg-(--color-surface-hi) text-(--color-muted) hover:bg-bg-2",
              !isIdle && "opacity-50",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      {isPlaying && (
        <button
          type="button"
          onClick={onCashout}
          disabled={!canCashout}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold transition active:scale-[0.98]",
            canCashout
              ? "bg-warning text-(--color-bg-0) shadow-glow-gold"
              : "bg-(--color-surface-hi) text-(--color-muted)",
          )}
        >
          <Zap size={14} />
          캐쉬아웃 @ {currentMult.toFixed(2)}x
        </button>
      )}

      <p className="text-center type-caption">1–0 = 상단 10칸 · R 랜덤 · C 캐쉬아웃 · ESC 검증</p>
    </div>
  );
}
