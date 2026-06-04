/**
 * PlinkoBoard — canvas + controls + bet panel. No header/back (Screen owns).
 *
 * TODO: Round G Part 1 완료 후 GameShell + useGameRound + plinkoStore로 마이그레이션 예정.
 *       현재는 임시 useState 구조. persistedGameState.ts 는 수정하지 않는다.
 * TODO: Real money 모드 — handlePlace 안의 engine.dropPath 호출을 Supabase Edge
 *       Function RPC로 위임. 잔액/히스토리는 서버 응답으로만 동기화 (현재는 optimistic).
 *
 * mode 는 부모 라우트(useMode())에서 prop 으로 주입한다. 내부 useState 금지.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PlinkoEngine, getMaxMultiplier, type RiskLevel, type RowCount } from "./PlinkoEngine";
import { PlinkoRenderer, type QualityLevel } from "./PlinkoRenderer";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { cn } from "@/lib/utils";

export interface PlinkoBoardProps {
  mode: "demo" | "real";
  /** Optional callback so the parent screen can surface lastOutcome → for auto-bet / fairness modal. */
  onOutcome?: (o: { outcome: "win" | "loss"; profit: number; nonce: number }) => void;
}

const ROW_OPTIONS: RowCount[] = [8, 12, 16];
const RISK_OPTIONS: RiskLevel[] = ["low", "medium", "high"];
const RISK_LABEL: Record<RiskLevel, string> = { low: "낮음", medium: "보통", high: "높음" };

interface HistoryEntry {
  id: string;
  multiplier: number;
  slot: number;
}

export function PlinkoBoard({ mode, onOutcome }: PlinkoBoardProps) {
  const [phase, setPhase] = useState<"idle" | "rolling" | "settled">("idle");
  const [balance, setBalance] = useState(1000);
  const [nonce, setNonce] = useState(0);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rows, setRows] = useState<RowCount>(16);
  const [risk, setRisk] = useState<RiskLevel>("medium");
  const [pendingAmount, setPendingAmount] = useState(10);
  const [lastOutcome, setLastOutcome] = useState<{
    outcome: "win" | "loss";
    profit: number;
    nonce: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PlinkoEngine | null>(null);
  const rendererRef = useRef<PlinkoRenderer | null>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Synchronous double-tap lock — blocks rapid second clicks before React state updates. */
  const placingRef = useRef(false);

  const quality: QualityLevel = useMemo(() => (mode === "real" ? "high" : "medium"), [mode]);

  useEffect(() => {
    if (!engineRef.current) engineRef.current = new PlinkoEngine();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!engineRef.current) engineRef.current = new PlinkoEngine();
    rendererRef.current = new PlinkoRenderer(canvas, { quality, rows, risk });
    return () => {
      if (settleTimerRef.current) {
        clearTimeout(settleTimerRef.current);
        settleTimerRef.current = null;
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
      // Synchronous double-tap guard FIRST — must precede the React-state guards
      // because rapid taps in the same tick all see stale `phase === "idle"`.
      if (placingRef.current) return;
      if (phase !== "idle") return;
      if (amount <= 0 || amount > balance) return;
      if (!engineRef.current || !rendererRef.current) return;
      placingRef.current = true;

      setBalance((b) => b - amount);
      setPendingAmount(amount);
      setPhase("rolling");

      const seed = `phonara-plinko-${nonce}`;
      const result = engineRef.current.dropPath(seed, rows, risk);

      // Push pending bet into live feed.
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
        const effectiveMult = mode === "real" ? multiplier * 0.97 : multiplier;
        const payout = amount * effectiveMult;
        const profit = payout - amount;
        const won = payout >= amount;

        if (payout > 0) setBalance((b) => b + payout);
        setHistory((h) => [{ id: `n${nonce}-${slot}`, multiplier, slot }, ...h].slice(0, 30));
        const outcome = { outcome: won ? ("win" as const) : ("loss" as const), profit, nonce };
        setLastOutcome(outcome);
        onOutcome?.(outcome);

        liveBetsStore.update(liveBetId, {
          multiplier: won ? effectiveMult : null,
          profit: +profit.toFixed(2),
          status: won ? "win" : "loss",
        });

        setPhase("settled");

        if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
        settleTimerRef.current = setTimeout(() => {
          setPhase("idle");
          setNonce((n) => n + 1);
          settleTimerRef.current = null;
          placingRef.current = false; // release lock for next round
        }, 800);
      });
    },
    [phase, balance, nonce, rows, risk, mode, onOutcome],
  );

  const canPlace = phase === "idle";

  return (
    <div className="flex flex-col gap-2">
      {/* History strip */}
      <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        {history.length === 0 ? (
          <li className="text-[11px] text-[var(--color-muted-2)]">아직 라운드 없음</li>
        ) : (
          history.slice(0, 12).map((h) => (
            <li
              key={h.id}
              className="font-numeric shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold"
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

      {/* Canvas — fixed-ish height, page scrolls */}
      <div
        ref={wrapRef}
        className="relative h-[460px] w-full overflow-hidden rounded-2xl bg-[var(--color-bg-1,#0a0f1a)] ring-1 ring-[var(--color-border)]"
      >
        <canvas ref={canvasRef} className="block h-full w-full" />
        {phase === "settled" && lastOutcome && (
          <div
            className={cn(
              "pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-full px-3 py-1 text-[11px] font-extrabold backdrop-blur",
              lastOutcome.outcome === "win"
                ? "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] text-[var(--color-emerald)]"
                : "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)] text-[var(--color-rose)]",
            )}
          >
            {lastOutcome.outcome === "win" ? "+" : ""}
            {lastOutcome.profit.toFixed(2)} USDT
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
        targetMultiplier={getMaxMultiplier(risk, rows)}
        winChancePct={undefined}
      />

      {/* Manual + Auto tabs. No auto-cashout target (Plinko resolves on landing). */}
      <StakeBetPanel
        showAutoTarget={false}
        canPlace={canPlace}
        hasActiveBet={false /* Plinko has no cashable in-flight bet */}
        balance={balance}
        lastOutcome={lastOutcome}
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
