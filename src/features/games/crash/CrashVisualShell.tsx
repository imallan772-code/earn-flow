import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, ChevronDown } from "lucide-react";
import { LiveCashoutStrip } from "@/shared/layout/LiveCashoutStrip";
import { Premium3DCard } from "@/shared/ui/Premium3DCard";
import { MOCK_BET_HISTORY } from "@/mocks/games";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Phase = "idle" | "betting" | "running" | "crashed" | "cashed";

interface Props {
  // MERGE: CrashGameAdapter (useGameWallet, RPC, RNG) reconnect via these props in phonara-world-main
  onMockBet?: () => void;
  onMockCashout?: () => void;
  disabled?: boolean;
}

export function CrashVisualShell({ disabled }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [multiplier, setMultiplier] = useState(1.0);
  const [stake, setStake] = useState(1000);
  const [showPF, setShowPF] = useState(false);

  function startBet() {
    // MERGE: replace with onMockBet → CrashGameAdapter.placeBet
    setPhase("running");
    setMultiplier(1.0);
    let m = 1;
    const id = setInterval(() => {
      m = +(m + 0.07).toFixed(2);
      setMultiplier(m);
      if (m >= 3.4 + Math.random() * 4) {
        clearInterval(id);
        setPhase("crashed");
        setTimeout(() => setPhase("idle"), 1400);
      }
    }, 80);
  }

  function cashout() {
    // MERGE: onMockCashout → CrashGameAdapter.cashout
    setPhase("cashed");
    toast.success(`💎 ${multiplier.toFixed(2)}× 캐시아웃 +${Math.round(stake * multiplier).toLocaleString()} PHON`);
    setTimeout(() => setPhase("idle"), 1400);
  }

  const isRunning = phase === "running";
  const isCrashed = phase === "crashed";

  return (
    <>
      <LiveCashoutStrip />

      <Premium3DCard className="relative overflow-hidden p-5" glow={isCrashed ? "pink" : "cyan"}>
        <div className="absolute inset-0 opacity-30">
          <svg viewBox="0 0 400 200" preserveAspectRatio="none" className="h-full w-full">
            <defs>
              <linearGradient id="curve" x1="0" x2="1" y1="1" y2="0">
                <stop offset="0%" stopColor="oklch(0.85 0.18 200)" stopOpacity="0" />
                <stop offset="100%" stopColor="oklch(0.85 0.18 200)" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <motion.path
              d={`M 0 200 Q ${100 + multiplier * 20} ${200 - multiplier * 30} 400 ${Math.max(0, 200 - multiplier * 50)}`}
              fill="none"
              stroke="url(#curve)"
              strokeWidth="3"
            />
          </svg>
        </div>

        <div className="relative z-10 flex h-48 flex-col items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={phase + multiplier.toFixed(2)}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="font-numeric text-7xl font-extrabold"
              style={{
                color: isCrashed ? "var(--color-rose)" : isRunning ? "var(--color-cyan)" : "var(--color-foreground)",
                textShadow: isRunning ? "0 0 30px color-mix(in oklab, var(--color-cyan) 60%, transparent)" : undefined,
              }}
            >
              {multiplier.toFixed(2)}×
            </motion.div>
          </AnimatePresence>
          <div className="mt-1 text-xs font-semibold uppercase tracking-wider">
            {phase === "idle" && <span className="text-[var(--color-muted)]">베팅 대기</span>}
            {isRunning && <span className="text-[var(--color-cyan)]">⚡ 비행 중</span>}
            {isCrashed && <span className="text-[var(--color-rose)]">💥 크래시</span>}
            {phase === "cashed" && <span className="text-[var(--color-gold)]">💎 캐시아웃</span>}
          </div>
        </div>

        <Rocket
          size={28}
          className="absolute"
          style={{
            color: "var(--color-cyan)",
            left: `${10 + Math.min(60, multiplier * 8)}%`,
            bottom: `${10 + Math.min(70, multiplier * 10)}%`,
            transform: "rotate(-25deg)",
            transition: "all .08s linear",
            opacity: isRunning ? 1 : 0.3,
          }}
        />
      </Premium3DCard>

      {/* Bet history pills */}
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {MOCK_BET_HISTORY.map((b) => (
          <span
            key={b.id}
            className="inline-flex h-7 items-center rounded-full px-2.5 font-numeric text-[11px] font-bold"
            style={{
              background: b.win ? "color-mix(in oklab, var(--color-emerald) 16%, transparent)" : "color-mix(in oklab, var(--color-rose) 16%, transparent)",
              color: b.win ? "var(--color-emerald)" : "var(--color-rose)",
            }}
          >
            {b.label}
          </span>
        ))}
      </div>

      {/* Stake panel */}
      <Premium3DCard className="p-4 space-y-3">
        <div>
          <div className="mb-1.5 text-xs font-semibold text-[var(--color-muted)]">베팅 금액 (PHON)</div>
          <div className="glass-1 flex items-center gap-2 rounded-2xl px-3 py-2">
            <input
              type="number"
              value={stake}
              onChange={(e) => setStake(Math.max(0, +e.target.value))}
              className="flex-1 bg-transparent font-numeric text-lg font-bold outline-none"
            />
            <div className="flex gap-1">
              {[2, 0.5].map((m) => (
                <button
                  key={m}
                  onClick={() => setStake((s) => Math.max(100, Math.round(s * m)))}
                  className="rounded-xl bg-white/8 px-2 py-1 text-xs font-semibold"
                >
                  {m === 2 ? "2×" : "½"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={startBet}
            disabled={disabled || isRunning}
            className={cn(
              "h-14 rounded-2xl font-extrabold transition-all",
              isRunning ? "bg-white/8 text-[var(--color-muted)]" : "bg-holographic text-[var(--color-bg-0)] shadow-glow-purple"
            )}
          >
            베팅
          </button>
          <button
            onClick={cashout}
            disabled={!isRunning}
            className={cn(
              "h-14 rounded-2xl font-extrabold transition-all",
              isRunning ? "bg-[var(--color-gold)] text-[var(--color-bg-0)] shadow-glow-gold" : "bg-white/8 text-[var(--color-muted)]"
            )}
          >
            캐시아웃 {isRunning && `(+${Math.round(stake * multiplier).toLocaleString()})`}
          </button>
        </div>
      </Premium3DCard>

      {/* Provably-fair fold */}
      <button
        onClick={() => setShowPF((v) => !v)}
        className="glass-1 flex items-center justify-between rounded-2xl px-4 py-3 text-xs font-semibold text-[var(--color-muted)]"
      >
        <span>🔐 Provably Fair · mock hash</span>
        <ChevronDown size={14} className={cn("transition-transform", showPF && "rotate-180")} />
      </button>
      {showPF && (
        <div className="glass-2 rounded-2xl p-4 font-numeric text-[10px] break-all text-[var(--color-muted)]">
          server seed: a7f3c2b8e1d4… · client seed: 9f2e1b… · nonce: 12,482
        </div>
      )}
    </>
  );
}
