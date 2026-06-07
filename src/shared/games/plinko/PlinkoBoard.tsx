/**
 * PlinkoBoard — thin shell: canvas view + controls + bet panel.
 * Wallet/settlement: usePlinkoRound · Canvas: PlinkoCanvasView
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlinkoEngine, getMaxMultiplier, type RiskLevel, type RowCount } from "./PlinkoEngine";
import { PlinkoRenderer, type QualityLevel } from "./PlinkoRenderer";
import { getPlinkoSFX } from "./PlinkoSFX";
import { PlinkoCanvasView } from "./PlinkoCanvasView";
import { usePlinkoRound } from "./usePlinkoRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { plinkoStore } from "@/shared/games/state/persistedGameState";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys } from "@/shared/hooks/useHotkeys";
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

function slotTint(mult: number): string {
  if (mult >= 10) return "var(--color-gold)";
  if (mult >= 2) return "var(--color-cyan)";
  if (mult >= 1) return "var(--color-muted)";
  return "var(--color-rose)";
}

export function PlinkoBoard({ mode, onOutcome }: PlinkoBoardProps) {
  const history = plinkoStore.use((s) => s.history);
  const pendingAmount = plinkoStore.use((s) => s.pendingAmount);
  const [muted, setMuted] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlinkoEngine | null>(null);
  const rendererRef = useRef<PlinkoRenderer | null>(null);

  const quality: QualityLevel = useMemo(() => (mode === "real" ? "high" : "medium"), [mode]);
  const rows = plinkoStore.use((s) => s.rows);
  const risk = plinkoStore.use((s) => s.risk);
  const maxMult = useMemo(() => getMaxMultiplier(risk, rows), [risk, rows]);

  const playDrop = useCallback(
    (
      result: ReturnType<PlinkoEngine["dropPath"]>,
      onLand: (slot: number, multiplier: number) => void,
    ) => {
      if (rendererRef.current && engineRef.current) {
        rendererRef.current.playDrop(result, engineRef.current, onLand);
        return;
      }
      onLand(result.finalSlot, result.multiplier);
    },
    [],
  );

  const { phase, jackpot, setJackpot, lastOutcome, nonce, balance, handlePlace, canPlace, autoCanPlace } =
    usePlinkoRound(mode, engineRef, playDrop, onOutcome);

  useEffect(() => {
    try {
      const v = localStorage.getItem(MUTE_KEY);
      if (v === "1") {
        setMuted(true);
        getPlinkoSFX().setMuted(true);
      }
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (!engineRef.current) engineRef.current = new PlinkoEngine();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas) return;
    if (!engineRef.current) engineRef.current = new PlinkoEngine();
    rendererRef.current = new PlinkoRenderer(canvas, {
      quality,
      rows,
      risk,
      onPegHit: (vel) => getPlinkoSFX().pegHit(vel),
    });
    if (wrap) {
      const rect = wrap.getBoundingClientRect();
      if (rect.width >= 1 && rect.height >= 1) {
        rendererRef.current.resize(rect.width, rect.height, window.devicePixelRatio || 1);
      }
    }
    return () => {
      rendererRef.current?.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    rendererRef.current?.setQuality(quality);
  }, [quality]);
  useEffect(() => {
    rendererRef.current?.setRows(rows);
  }, [rows]);
  useEffect(() => {
    rendererRef.current?.setRisk(risk);
  }, [risk]);

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

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      getPlinkoSFX().setMuted(next);
      try {
        localStorage.setItem(MUTE_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      if (!next) getPlinkoSFX().resume();
      return next;
    });
  }, []);

  // ROUND M: ←/→ = risk cycle (only when queue empty). Mute = M. Hotkeys
  // auto-ignore input/textarea/contentEditable (useHotkeys guard) — AC-M-7.
  const cycleRisk = useCallback(
    (dir: 1 | -1) => {
      if (phase !== "idle") return;
      const idx = RISK_OPTIONS.indexOf(risk);
      const nextRisk = RISK_OPTIONS[(idx + dir + RISK_OPTIONS.length) % RISK_OPTIONS.length];
      plinkoStore.set((s) => ({ ...s, risk: nextRisk }));
    },
    [phase, risk],
  );
  useHotkeys({
    ArrowLeft: () => cycleRisk(-1),
    ArrowRight: () => cycleRisk(1),
    m: () => toggleMute(),
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ul className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
          {history.length === 0 ? (
            <li className="text-[11px] text-muted-2">아직 라운드 없음</li>
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
          className="grid size-8 shrink-0 place-items-center rounded-lg text-(--color-muted) transition hover:text-(--color-foreground)"
          aria-label={muted ? "사운드 켜기" : "사운드 끄기"}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      <PlinkoCanvasView
        wrapRef={wrapRef}
        canvasRef={canvasRef}
        phase={phase}
        lastOutcome={lastOutcome}
        jackpot={jackpot}
        onDismissJackpot={() => setJackpot(null)}
      />

      <div className="grid h-11 grid-cols-2 gap-2">
        <div className="glass-1 flex items-center gap-1 rounded-xl p-1">
          {RISK_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => plinkoStore.set((s) => ({ ...s, risk: r }))}
              disabled={phase !== "idle"}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50",
                risk === r ? "bg-(--color-cyan) text-(--color-bg-0)" : "text-(--color-muted)",
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
              onClick={() => plinkoStore.set((s) => ({ ...s, rows: n }))}
              disabled={phase !== "idle"}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-[11px] font-bold transition disabled:opacity-50",
                rows === n ? "bg-(--color-cyan) text-(--color-bg-0)" : "text-(--color-muted)",
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

      <DemoLowBanner />

      <StakeBetPanel
        showAutoTarget={false}
        canPlace={canPlace}
        autoCanPlace={autoCanPlace}
        hasActiveBet={phase !== "idle"}
        balance={balance}
        bettingRoundKey={nonce}
        lastOutcome={
          lastOutcome
            ? { outcome: lastOutcome.outcome, profit: lastOutcome.profit, nonce: lastOutcome.nonce }
            : null
        }
        defaultAmount={pendingAmount}
        onAmountChange={(amount) => plinkoStore.set((s) => ({ ...s, pendingAmount: amount }))}
        onPlace={(amount) => handlePlace(amount)}
        onCashout={() => {}}
        serverAutoBet={{
          game: "plinko",
          getBetParams: () => ({
            rows: plinkoStore.get().rows,
            risk: plinkoStore.get().risk,
          }),
        }}
      />

      <div className="text-center text-[11px] text-muted-2 font-numeric">
        잔액 <span className="text-(--color-foreground)">{balance.toFixed(2)}</span> USDT
        {" · "}#{nonce.toString().padStart(4, "0")}
      </div>
    </div>
  );
}
