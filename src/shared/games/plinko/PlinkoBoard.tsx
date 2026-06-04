/**
 * PlinkoBoard — Plinko game screen (temporary inline structure).
 *
 * TODO: Round G Part 1 완료 후 GameShell + useGameRound + plinkoStore로 마이그레이션 예정.
 *       현재는 임시 useState 구조. persistedGameState.ts 는 수정하지 않는다.
 * TODO: Real money 모드 — handlePlace 안의 engine.dropPath 호출을 Supabase Edge
 *       Function RPC로 위임. 잔액/히스토리는 서버 응답으로만 동기화 (현재는 optimistic).
 *
 * mode 는 부모 라우트(useMode())에서 prop 으로 주입한다. 내부 useState 금지.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { PlinkoEngine, type RiskLevel, type RowCount } from "./PlinkoEngine";
import { PlinkoRenderer, type QualityLevel } from "./PlinkoRenderer";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { cn } from "@/lib/utils";

export interface PlinkoBoardProps {
  mode: "demo" | "real";
}

const ROW_OPTIONS: RowCount[] = [8, 12, 16];
const RISK_OPTIONS: RiskLevel[] = ["low", "medium", "high"];
const RISK_LABEL: Record<RiskLevel, string> = { low: "낮음", medium: "보통", high: "높음" };

interface HistoryEntry {
  id: string;
  multiplier: number;
  slot: number;
}

export function PlinkoBoard({ mode }: PlinkoBoardProps) {
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

  // Quality derives from mode. Real money → max polish.
  const quality: QualityLevel = useMemo(() => (mode === "real" ? "high" : "medium"), [mode]);

  // Engine lazy init — React 19 strict mode safe (effect runs twice but guard prevents dup).
  useEffect(() => {
    if (!engineRef.current) engineRef.current = new PlinkoEngine();
  }, []);

  // CRITICAL: deps 는 []. quality/rows/risk 를 절대 추가하지 말 것.
  // 변경 반영은 아래 동기화 useEffect 3개의 set* 호출로만 처리한다.
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

  // mode 변경 시 즉시 renderer.setQuality 호출. 진행 중이면 Renderer 내부에서 pendingQuality 로 defer.
  useEffect(() => {
    rendererRef.current?.setQuality(quality);
  }, [quality]);
  // rows 변경 시 static layer 재빌드 (slot/peg 좌표 재계산).
  useEffect(() => {
    rendererRef.current?.setRows(rows);
  }, [rows]);
  // risk 변경 시 슬롯 색상 정규화 재계산.
  useEffect(() => {
    rendererRef.current?.setRisk(risk);
  }, [risk]);

  // ResizeObserver — rAF coalesce + 0×0 가드. DPR 변화는 ResizeObserver 가 사실상 잡아냄.
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

  const handlePlace = (amount: number) => {
    if (phase !== "idle") return;
    if (amount <= 0 || amount > balance) return;
    if (!engineRef.current || !rendererRef.current) return;

    setBalance((b) => b - amount);
    setPendingAmount(amount);
    setPhase("rolling");

    const seed = `phonara-plinko-${nonce}`;
    // TODO: Real money — Supabase Edge Function RPC 로 위임.
    const result = engineRef.current.dropPath(seed, rows, risk);

    rendererRef.current.playDrop(result, engineRef.current, (slot, multiplier) => {
      // mode === "real" 일 때만 RTP 97% 적용 (BetSummaryPanel/houseEdge 일관성).
      const effectiveMult = mode === "real" ? multiplier * 0.97 : multiplier;
      const payout = amount * effectiveMult;
      const profit = payout - amount;
      const won = payout >= amount;

      if (payout > 0) setBalance((b) => b + payout);
      setHistory((h) => [{ id: `n${nonce}-${slot}`, multiplier, slot }, ...h].slice(0, 30));
      setLastOutcome({ outcome: won ? "win" : "loss", profit, nonce });
      setPhase("settled");

      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        setPhase("idle");
        setNonce((n) => n + 1);
        settleTimerRef.current = null;
      }, 800);
    });
  };

  const canPlace = phase === "idle";

  return (
    <div className="flex h-[100dvh] w-full flex-col bg-[var(--color-bg-0)] pb-[env(safe-area-inset-bottom)] text-[var(--color-foreground)]">
      {/* Header */}
      <div className="flex h-9 items-center justify-between px-3 text-xs">
        <span className="font-bold uppercase tracking-wider text-[var(--color-cyan)]">
          PLINKO
        </span>
        <span className="font-numeric text-[var(--color-muted)]">
          잔액 <span className="text-[var(--color-foreground)]">{balance.toFixed(2)}</span> USDT
        </span>
      </div>

      {/* History strip */}
      <div className="flex h-7 items-center gap-1 overflow-x-auto px-3">
        {history.length === 0 ? (
          <span className="text-[10px] text-[var(--color-muted-2)]">최근 결과 없음</span>
        ) : (
          history.slice(0, 12).map((h) => (
            <span
              key={h.id}
              className="font-numeric rounded px-1.5 py-0.5 text-[10px] font-bold"
              style={{
                background: `color-mix(in oklab, ${slotTint(h.multiplier)} 18%, transparent)`,
                color: slotTint(h.multiplier),
              }}
            >
              {h.multiplier}x
            </span>
          ))
        )}
      </div>

      {/* Canvas — flex-1, capped so 100dvh-260 floor still leaves room for controls on SE */}
      <div
        ref={wrapRef}
        className="relative mx-3 my-1 flex-1 overflow-hidden rounded-2xl bg-[var(--color-bg-1,#0a0f1a)] ring-1 ring-[var(--color-border)]"
        style={{ minHeight: 0, maxHeight: "min(420px, calc(100dvh - 260px))" }}
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

      {/* Risk + Rows controls (single row, 44px) */}
      <div className="mx-3 mb-1 grid h-11 grid-cols-2 gap-2">
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

      {/* Bet summary */}
      <div className="mx-3 mb-1">
        <BetSummaryPanel
          variant="static"
          amount={pendingAmount}
          targetMultiplier={maxMultFor(risk, rows)}
          winChancePct={undefined}
        />
      </div>

      {/* Stake bet panel (compact, manual only — no auto-cashout for Plinko) */}
      <div className="mx-3 mb-2">
        <StakeBetPanel
          variant="compact"
          showAutoTarget={false}
          canPlace={canPlace}
          hasActiveBet={phase !== "idle"}
          balance={balance}
          lastOutcome={lastOutcome}
          onPlace={(amount) => handlePlace(amount)}
          onCashout={() => {
            /* Plinko has no cashout — settled at landing */
          }}
        />
      </div>
    </div>
  );
}

/** Quick tint for history chips. Matches Renderer.slotColor heuristic. */
function slotTint(mult: number): string {
  if (mult >= 10) return "var(--color-gold)";
  if (mult >= 2) return "var(--color-cyan)";
  if (mult >= 1) return "var(--color-muted)";
  return "var(--color-rose)";
}

/** Max-mult lookup mirrors PlinkoRenderer's MAX_MULT (kept inline to avoid extra export). */
function maxMultFor(risk: RiskLevel, rows: RowCount): number {
  // simple hardcoded mirror — Renderer derives from MULTIPLIERS, here we use a small map.
  const MAX: Record<RiskLevel, Record<RowCount, number>> = {
    low: { 8: 5.6, 12: 10, 16: 16 },
    medium: { 8: 13, 12: 33, 16: 110 },
    high: { 8: 29, 12: 76, 16: 1000 },
  };
  return MAX[risk][rows];
}
