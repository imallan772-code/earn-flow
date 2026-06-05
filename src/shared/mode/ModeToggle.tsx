/**
 * ModeToggle — global Demo/Real switch shown at the top of Home.
 *
 * - Real 전환: confirm 모달(실 잔액 사용 안내)
 * - Demo 전환: confirm 모달(체험 크레딧 1회성 안내)
 */
import { Gamepad2, Gem } from "lucide-react";
import { useMode, type GameMode } from "./ModeContext";
import { useBalance } from "@/shared/wallet/walletStore";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  size?: "md" | "sm";
}

export function ModeToggle({ className, size = "md" }: Props) {
  const { mode, setMode } = useMode();
  const demoBalance = useBalance("demo");

  function pick(m: GameMode) {
    if (m === mode) return;
    if (m === "real") {
      const ok = window.confirm(
        "리얼 모드로 전환합니다. 실제 잔액으로 베팅이 진행됩니다. 계속하시겠습니까?",
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        "데모는 체험용입니다. 체험 크레딧은 1회만 지급되며 추가 리필되지 않습니다. 계속하시겠습니까?",
      );
      if (!ok) return;
    }
    setMode(m);
  }

  const padY = size === "sm" ? "py-1.5" : "py-2.5";
  const padX = size === "sm" ? "px-3" : "px-4";
  const txt = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className={cn("glass-2 grid grid-cols-2 gap-1 rounded-2xl p-1 shadow-depth-2", className)}>
      <button
        onClick={() => pick("demo")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl font-bold transition-all",
          padX,
          padY,
          txt,
          mode === "demo"
            ? "bg-(--color-cyan) text-(--color-bg-0) shadow-glow-cyan"
            : "text-(--color-muted) hover:text-(--color-foreground)",
        )}
        aria-pressed={mode === "demo"}
      >
        <Gamepad2 size={size === "sm" ? 14 : 16} />
        <span>데모</span>
        {mode === "demo" && (
          <span className="font-numeric ml-1 rounded-full bg-(--color-bg-0)/20 px-1.5 py-0.5 text-[9px] font-bold">
            ₩{demoBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        )}
      </button>
      <button
        onClick={() => pick("real")}
        className={cn(
          "flex items-center justify-center gap-2 rounded-xl font-bold transition-all",
          padX,
          padY,
          txt,
          mode === "real"
            ? "bg-gold text-(--color-bg-0) shadow-glow-gold"
            : "text-(--color-muted) hover:text-(--color-foreground)",
        )}
        aria-pressed={mode === "real"}
      >
        <Gem size={size === "sm" ? 14 : 16} />
        <span>리얼</span>
        {mode === "real" && (
          <span className="ml-1 rounded-full bg-(--color-bg-0)/20 px-1.5 py-0.5 text-[9px] font-bold">
            RTP 97%
          </span>
        )}
      </button>
    </div>
  );
}

/** Small badge for game headers */
export function ModeBadge({ className }: { className?: string }) {
  const { mode, rtpLabel } = useMode();
  const color = mode === "demo" ? "cyan" : "gold";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold",
        className,
      )}
      style={{
        background: `color-mix(in oklab, var(--color-${color}) 22%, transparent)`,
        color: `var(--color-${color})`,
      }}
    >
      {mode === "demo" ? "🎮" : "💎"} {rtpLabel}
    </span>
  );
}
