/**
 * PlinkoBoard — canvas + controls + bet panel + SFX + jackpot overlay.
 *
 * Visual/audio/haptic upgrades wired through PlinkoSFX and renderer callbacks.
 * Engine + payout accounting unchanged.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlinkoEngine, getMaxMultiplier, MULTIPLIERS, type RiskLevel, type RowCount } from "./PlinkoEngine";
import { PlinkoRenderer, type QualityLevel } from "./PlinkoRenderer";
import { getPlinkoSFX } from "./PlinkoSFX";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { cn } from "@/lib/utils";
import { Volume2, VolumeX } from "lucide-react";

export interface PlinkoBoardProps {
  mode: "demo" | "real";
  onOutcome?: (o: { outcome: "win" | "loss"; profit: number; nonce: number }) => void;
}

const ROW_OPTIONS: RowCount[] = [8, 12, 16];
const RISK_OPTIONS: RiskLevel[] = ["low", "medium", "high"];
const RISK_LABEL: Record<RiskLevel, string> = { low: "낮음", medium: "보통", high: "높음" };
const MUTE_KEY = "phonara.plinko.muted";

interface HistoryEntry {
  id: string;
  multiplier: number;
  slot: number;
}

interface LastOutcome {
  outcome: "win" | "loss";
  profit: number;
  multiplier: number;
  bet: number;
  payout: number;
  nonce: number;
  jackpot: boolean;
}

export function PlinkoBoard({ mode, onOutcome }: PlinkoBoardProps) {
  const [phase, setPhase] = useState<"idle" | "rolling" | "settled">("idle");
  const [balance, setBalance] = useState(1000);
  const [nonce, setNonce] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rows, setRows] = useState<RowCount>(16);
  const [risk, setRisk] = useState<RiskLevel>("medium");
  const [pendingAmount, setPendingAmount] = useState(10);
  const [lastOutcome, setLastOutcome] = useState<LastOutcome | null>(null);
  const [muted, setMuted] = useState(false);
  const [jackpot, setJackpot] = useState<LastOutcome | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlinkoEngine | null>(null);
  const rendererRef = useRef<PlinkoRenderer | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jackpotTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const placingRef = useRef(false);

  const quality: QualityLevel = useMemo(() => (mode === "real" ? "high" : "medium"), [mode]);
  const maxMult = useMemo(() => getMaxMultiplier(risk, rows), [risk, rows]);

  // Load mute pref
  useEffect(() => {
    try {
      const v = localStorage.getItem(MUTE_KEY);
      if (v === "1") {
        setMuted(true);
        getPlinkoSFX().setMuted(true);
      }
    } catch { /* noop */ }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      getPlinkoSFX().setMuted(next);
      try { localStorage.setItem(MUTE_KEY, next ? "1" : "0"); } catch { /* noop */ }
      if (!next) getPlinkoSFX().resume();
      return next;
    });
  }, []);

  useEffect(() => {
    if (!engineRef.current) engineRef.current = new PlinkoEngine();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!engineRef.current) engineRef.current = new PlinkoEngine();
    rendererRef.current = new PlinkoRenderer(canvas, {
      quality,
      rows,
      risk,
      onPegHit: (vel) => getPlinkoSFX().pegHit(vel),
    });
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
      }
      if (jackpotTimerRef.current) {
        clearTimeout(jackpotTimerRef.current);
        jackpotTimerRef.current = null;
      }
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { rendererRef.current?.setQuality(quality); }, [quality]);
  useEffect(() => { rendererRef.current?.setRows(rows); }, [rows]);
  useEffect(() => { rendererRef.current?.setRisk(risk); }, [risk]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let rafId = 0;
    const flush = () => {
      rafId = 0;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      rendererRef.current?.resize(rect.width, rect.height, window.devicePixelRatio || 1);
    };
    const observer = new ResizeObserver(() => {
      if (!rafId) rafId = requestAnimationFrame(flush);
    });
    observer.observe(el);
    flush();
    return () => {
      observer.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const handlePlace = useCallback(
    (amount: number) => {
      if (placingRef.current) return;
      if (phase !== "idle") return;
      if (amount <= 0 || amount > balance) return;
      if (!engineRef.current || !rendererRef.current) return;
      placingRef.current = true;

      // Unlock + play release SFX (user gesture path)
      const sfx = getPlinkoSFX();
      sfx.resume();
      sfx.ballRelease();

      setBalance((b) => b - amount);
      setPendingAmount(amount);
      setPhase("rolling");

      const seed = `phonara-plinko-${nonce}`;
      const result = engineRef.current.dropPath(seed, rows, risk);

      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "plinko",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });

      rendererRef.current.playDrop(result, engineRef.current, (slot, multiplier) => {
        const grossPayout = amount * multiplier;
        const rake = mode === "real" ? grossPayout * 0.03 : 0;
        const payout = grossPayout - rake;
        const profit = payout - amount;
        const won = payout >= amount;

        if (payout > 0) setBalance((b) => b + payout);
        setHistory((h) => [{ id: `n${nonce}-${slot}`, multiplier, slot }, ...h].slice(0, 30));

        const max = Math.max(...MULTIPLIERS[risk][rows]);
        const isJackpot = multiplier >= max * 0.5 && multiplier >= 5;
        const outcomePayload: LastOutcome = {
          outcome: won ? "win" : "loss",
          profit,
          multiplier,
          bet: amount,
          payout,
          nonce,
          jackpot: isJackpot,
        };
        setLastOutcome(outcomePayload);
        onOutcome?.({ outcome: outcomePayload.outcome, profit, nonce });

        // SFX + haptic
        sfx.landSound(multiplier, max);
        if (typeof navigator !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate(isJackpot ? [50, 30, 80] : won ? [30] : [12]);
          } catch { /* noop */ }
        }

        // Jackpot overlay
        if (isJackpot) {
          setJackpot(outcomePayload);
          if (jackpotTimerRef.current) clearTimeout(jackpotTimerRef.current);
          jackpotTimerRef.current = setTimeout(() => setJackpot(null), 2200);
        }

        liveBetsStore.update(liveBetId, {
          multiplier: won ? multiplier : null,
          profit: +profit.toFixed(2),
          status: won ? "win" : "loss",
        });

        setPhase("settled");

        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
          setPhase("idle");
          setNonce((n) => n + 1);
          settleTimerRef.current = null;
          placingRef.current = false;
        }, 800);
      });
    },
    [phase, balance, nonce, rows, risk, mode, onOutcome],
  );

  const canPlace = phase === "idle";

  return (
    <div className="flex flex-col gap-2">
      {/* History strip + mute */}
      <div className="flex items-center gap-2">
        <ul className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
          {history.length === 0 ? (
            <li className="text-[11px] text-[var(--color-muted-2)]">아직 라운드 없음</li>
          ) : (
            history.slice(0, 12).map((h) => (
              <li
                key={h.id}
                className="font-numeric shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold animate-fade-in"
                style={{
                  background: `color-mix(in oklab, ${slotTint(h.multiplier)} 18%, transparent)`,
                  color: slotTint(h.multiplier),
                }}
              >
                {h.multiplier}x
              </li>
            ))
          )}
        </ul>
        <button
          onClick={toggleMute}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-[var(--color-muted)] transition hover:text-[var(--color-foreground)]"
          aria-label={muted ? "사운드 켜기" : "사운드 끄기"}
          title={muted ? "사운드 켜기" : "사운드 끄기"}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      {/* Canvas */}
      <div
        ref={wrapRef}
        className="relative h-[460px] w-full overflow-hidden rounded-2xl bg-[var(--color-bg-1,#0a0f1a)] ring-1 ring-[var(--color-border)]"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />

        {/* Jackpot overlay */}
        {jackpot && (
          <button
            type="button"
            onClick={() => setJackpot(null)}
            className="absolute inset-0 grid place-items-center bg-gradient-to-b from-[rgba(251,191,36,0.18)] via-transparent to-[rgba(0,0,0,0.4)] animate-fade-in"
            aria-label="잭팟"
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#fde68a]">JACKPOT</div>
              <div
                className="font-numeric text-6xl font-black text-[#fde68a] animate-scale-in"
                style={{ textShadow: "0 0 28px rgba(251,191,36,0.9), 0 0 60px rgba(251,191,36,0.6)" }}
              >
                {jackpot.multiplier}x
              </div>
              <div className="font-numeric text-2xl font-extrabold text-[#fef3c7]">
                +{jackpot.profit.toFixed(2)} USDT
              </div>
            </div>
          </button>
        )}

        {/* Settled result card */}
        {phase === "settled" && lastOutcome && !jackpot && (
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-xl px-3 py-1.5 text-center backdrop-blur animate-fade-in",
              lastOutcome.outcome === "win"
                ? "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)]"
                : "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)]",
            )}
          >
            <div
              className={cn(
                "font-numeric text-sm font-extrabold leading-tight",
                lastOutcome.outcome === "win"
                  ? "text-[var(--color-emerald)]"
                  : "text-[var(--color-rose)]",
              )}
            >
              {lastOutcome.outcome === "win" ? "+" : ""}
              {lastOutcome.profit.toFixed(2)} USDT
            </div>
            <div className="font-numeric text-[10px] text-[var(--color-muted-2)]">
              {lastOutcome.bet.toFixed(2)} × {lastOutcome.multiplier}x = {lastOutcome.payout.toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {/* Risk + Rows controls */}
      <div className="grid h-11 grid-cols-2 gap-2">
        <div className="glass-1 flex items-center gap-1 rounded-xl p-1">
          {RISK_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setRisk(r)}
              disabled={phase !== "idle"}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50",
                risk === r
                  ? "bg-[var(--color-cyan)] text-[var(--color-bg-0)]"
                  : "text-[var(--color-muted)]",
              )}
            >
              {RISK_LABEL[r]}
            </button>
          ))}
        </div>
        <div className="glass-1 flex items-center gap-1 rounded-xl p-1">
          {ROW_OPTIONS.map((n) => (
            <button
              key={n}
              onClick={() => setRows(n)}
              disabled={phase !== "idle"}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-[11px] font-bold transition disabled:opacity-50",
                rows === n
                  ? "bg-[var(--color-cyan)] text-[var(--color-bg-0)]"
                  : "text-[var(--color-muted)]",
              )}
            >
              {n}줄
            </button>
          ))}
        </div>
      </div>

      <BetSummaryPanel
        variant="static"
        amount={pendingAmount}
        targetMultiplier={maxMult}
        winChancePct={undefined}
      />

      <StakeBetPanel
        showAutoTarget={false}
        canPlace={canPlace}
        hasActiveBet={false}
        balance={balance}
        lastOutcome={lastOutcome ? { outcome: lastOutcome.outcome, profit: lastOutcome.profit, nonce: lastOutcome.nonce } : null}
        onPlace={(amount) => handlePlace(amount)}
        onCashout={() => { /* Plinko has no cashout */ }}
      />

      <div className="text-center text-[11px] text-[var(--color-muted-2)] font-numeric">
        잔액 <span className="text-[var(--color-foreground)]">{balance.toFixed(2)}</span> USDT
        {" · "}#{nonce.toString().padStart(4, "0")}
      </div>
    </div>
  );
}

function slotTint(mult: number): string {
  if (mult >= 10) return "var(--color-gold)";
  if (mult >= 2) return "var(--color-cyan)";
  if (mult >= 1) return "var(--color-muted)";
  return "var(--color-rose)";
}
