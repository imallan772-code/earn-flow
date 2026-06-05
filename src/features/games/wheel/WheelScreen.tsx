/**
 * WheelScreen — Stake-style Wheel. single-step on GameShell.
 *
 * 패턴 (MinesScreen 미러)
 *  - useGameRound({ rollingMs: 1400, settledMs: 1000 }) — 회전 애니메이션 시간 반영
 *  - GameShell 슬롯 주입. LiveBetsFeed는 GameShell 바깥.
 *  - 영속: nonce, history, lastOutcome, risk, segments, pendingAmount.
 *  - 정산: profitOf(amount, multiplier, mode). multiplier=0 → 패배(크레딧 없음).
 *  - SVG 휠 + framer-motion(LazyMotion 활성) 회전. 색상은 @theme 토큰만.
 *
 * TODO(real-money): spin은 Edge Function 위임. 테이블/계산은 그대로 재사용.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Disc3, ShieldCheck, X } from "lucide-react";
import { m } from "framer-motion";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { WHEEL_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import {
  WHEEL_RISKS,
  WHEEL_SEGMENT_OPTIONS,
  expectedMultiplier,
  getSegments,
  multiplierAt,
  spin,
  type WheelRisk,
  type WheelSegments,
} from "@/shared/games/wheel/WheelEngine";
import { wheelStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";

const SERVER_SEED = "phonara-wheel-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";
const FULL_TURNS = 5; // 회전 수
const WHEEL_SIZE = 220;
const STROKE = 28;

interface ActiveBet {
  amount: number;
  risk: WheelRisk;
  segments: WheelSegments;
  liveBetId: string;
  nonce: number;
}

function colorForMult(mult: number): string {
  if (mult === 0) return "var(--color-muted)";
  if (mult <= 1) return "var(--color-cyan)";
  if (mult <= 2) return "var(--color-emerald)";
  if (mult <= 5) return "var(--color-gold)";
  return "var(--color-rose)";
}

export function WheelScreen() {
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = wheelStore.use((s) => s.nonce);
  const history = wheelStore.use((s) => s.history);
  const lastOutcome = wheelStore.use((s) => s.lastOutcome);
  const risk = wheelStore.use((s) => s.risk);
  const segments = wheelStore.use((s) => s.segments);
  const pendingAmount = wheelStore.use((s) => s.pendingAmount);

  const round = useGameRound({ rollingMs: 1400, settledMs: 1000 });
  const [active, setActive] = useState<ActiveBet | null>(null);
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // rolling → spin & settle
  useEffect(() => {
    if (round.phase !== "rolling" || !active) return;
    let alive = true;
    spin(
      { serverSeed: SERVER_SEED, clientSeed: CLIENT_SEED, nonce: active.nonce },
      active.segments,
    ).then((idx) => {
      if (!alive) return;
      const mult = multiplierAt(active.risk, active.segments, idx);
      const won = mult > 0;
      const profit = won ? profitOf(active.amount, mult, mode) : -active.amount;
      // 회전각: 12시(상단)에 위치한 포인터에 결과 세그먼트 중심이 오도록.
      const perSeg = 360 / active.segments;
      const targetAngle = FULL_TURNS * 360 - (idx * perSeg + perSeg / 2);
      setResultIndex(idx);
      setRotation(targetAngle);
      if (won) {
        void credit(active.amount + profit, mult, {
          game: "wheel",
          roundId: `n${active.nonce}`,
        });
      }
      wheelStore.set((s) => ({
        ...s,
        history: [
          {
            id: `n${active.nonce}`,
            risk: active.risk,
            segments: active.segments,
            index: idx,
            multiplier: mult,
            win: won,
          },
          ...s.history,
        ].slice(0, 30),
        lastOutcome: {
          outcome: won ? "win" : "loss",
          profit,
          nonce: active.nonce,
          risk: active.risk,
          segments: active.segments,
          index: idx,
          multiplier: mult,
        },
      }));
      liveBetsStore.update(active.liveBetId, {
        multiplier: won ? mult : null,
        profit: won ? +profit.toFixed(2) : -active.amount,
        status: won ? "win" : "loss",
      });
      if (won) appToast.game.win({ amount: formatPHON(profit) });
      else appToast.game.lose({ amount: formatPHON(active.amount) });
      settledRef.current = true;
    });
    return () => {
      alive = false;
    };
  }, [round.phase, active, mode, credit]);

  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    settledRef.current = false;
    setActive(null);
    setResultIndex(null);
    wheelStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
  }, [round.phase]);

  const setRisk = useCallback((r: WheelRisk) => {
    wheelStore.set((s) => ({ ...s, risk: r }));
  }, []);
  const setSegmentsValue = useCallback((n: WheelSegments) => {
    wheelStore.set((s) => ({ ...s, segments: n }));
  }, []);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const ok = await tryDebit(amount, { game: "wheel", roundId: `n${nonce}` });
      if (!ok) return;
      wheelStore.set((s) => ({ ...s, pendingAmount: amount }));
      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "wheel",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      setActive({ amount, risk, segments, liveBetId, nonce });
      setResultIndex(null);
      round.place();
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [round, mode, risk, segments, nonce, tryDebit],
  );

  const segArray = useMemo(() => getSegments(risk, segments), [risk, segments]);
  const segPaths = useMemo(() => buildSegmentPaths(segArray.length), [segArray.length]);
  const avgMult = useMemo(() => expectedMultiplier(risk, segments), [risk, segments]);
  const resultMult =
    resultIndex != null ? multiplierAt(active?.risk ?? risk, active?.segments ?? segments, resultIndex) : null;

  return (
    <div className="flex flex-col gap-2">
      <GameShell
        header={
          <header className="flex items-center gap-2">
            <Link
              to="/earn"
              className="glass-1 grid h-9 w-9 place-items-center rounded-full"
              aria-label="뒤로"
            >
              <ArrowLeft size={16} />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold leading-tight">Wheel</h1>
              <ModeBadge className="mt-0.5" />
            </div>
            <span className="glass-1 ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold text-(--color-muted) font-numeric">
              #{nonce.toString().padStart(4, "0")}
            </span>
            <button
              onClick={() => setShowFair(true)}
              className="glass-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
            >
              <ShieldCheck size={12} className="text-emerald" />
              공정성
            </button>
          </header>
        }
        rulesCard={<GameRulesCard rules={WHEEL_RULES} onVerify={() => setShowFair(true)} />}
        historyStrip={
          <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
            {history.map((h) => (
              <li
                key={h.id}
                className={cn(
                  "font-numeric shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold",
                  h.win
                    ? "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] text-emerald"
                    : "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)] text-(--color-rose)",
                )}
              >
                {h.multiplier.toFixed(2)}x
              </li>
            ))}
            {history.length === 0 && (
              <li className="text-[11px] text-muted-2">아직 라운드 없음</li>
            )}
          </ul>
        }
        displayArea={
          <div className="glass-2 grid place-items-center rounded-2xl p-3">
            <div className="relative" style={{ width: WHEEL_SIZE, height: WHEEL_SIZE }}>
              {/* 포인터 — 12시 고정 */}
              <div
                className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
                aria-hidden
              >
                <div
                  className="h-3 w-3 -translate-y-1 rotate-45 rounded-sm bg-gold shadow-glow-gold"
                />
              </div>
              <m.svg
                width={WHEEL_SIZE}
                height={WHEEL_SIZE}
                viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
                animate={{ rotate: rotation }}
                transition={{ duration: 1.3, ease: [0.2, 0.7, 0.2, 1] }}
                style={{ transformOrigin: "50% 50%" }}
              >
                {segPaths.map((p, i) => (
                  <path
                    key={i}
                    d={p}
                    fill={colorForMult(segArray[i])}
                    fillOpacity={segArray[i] === 0 ? 0.25 : 0.85}
                    stroke="var(--color-bg-0)"
                    strokeWidth={1}
                  />
                ))}
                <circle
                  cx={WHEEL_SIZE / 2}
                  cy={WHEEL_SIZE / 2}
                  r={WHEEL_SIZE / 2 - STROKE - 6}
                  fill="var(--color-bg-0)"
                />
              </m.svg>
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
                    결과
                  </div>
                  <div
                    className="font-numeric text-2xl font-extrabold"
                    style={{
                      color:
                        resultMult != null
                          ? colorForMult(resultMult)
                          : "var(--color-foreground)",
                    }}
                  >
                    {resultMult != null
                      ? `${resultMult.toFixed(2)}x`
                      : round.phase === "rolling"
                        ? "···"
                        : `${avgMult.toFixed(2)}x`}
                  </div>
                </div>
              </div>
            </div>
          </div>
        }
        controls={
          <div className="glass-2 flex flex-col gap-2 rounded-2xl p-3">
            <div className="flex items-center gap-2">
              <span className="w-14 text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
                위험도
              </span>
              <div className="glass-1 grid flex-1 grid-cols-3 rounded-xl p-1">
                {WHEEL_RISKS.map((r) => (
                  <button
                    key={r}
                    onClick={() => setRisk(r)}
                    disabled={!round.isIdle}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50",
                      risk === r
                        ? "bg-(--color-cyan) text-(--color-bg-0)"
                        : "text-(--color-muted)",
                    )}
                  >
                    {r === "low" ? "낮음" : r === "medium" ? "보통" : "높음"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-14 text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
                세그먼트
              </span>
              <div className="glass-1 grid flex-1 grid-cols-3 rounded-xl p-1">
                {WHEEL_SEGMENT_OPTIONS.map((n) => (
                  <button
                    key={n}
                    onClick={() => setSegmentsValue(n)}
                    disabled={!round.isIdle}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-[11px] font-bold transition disabled:opacity-50",
                      segments === n
                        ? "bg-(--color-cyan) text-(--color-bg-0)"
                        : "text-(--color-muted)",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        }
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={pendingAmount}
            targetMultiplier={Math.max(1.01, avgMult)}
          />
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            canPlace={round.isIdle}
            hasActiveBet={false}
            balance={balance}
            lastOutcome={
              lastOutcome
                ? {
                    outcome: lastOutcome.outcome,
                    profit: lastOutcome.profit,
                    nonce: lastOutcome.nonce,
                  }
                : null
            }
            showAutoTarget={false}
            onPlace={(amount) => {
              wheelStore.set((s) => ({ ...s, pendingAmount: amount }));
              void handlePlace(amount);
            }}
            onCashout={() => {}}
          />
        }
      />

      <LiveBetsFeed game="wheel" limit={10} />

      {showFair && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowFair(false)}
        >
          <div
            className="glass-2 w-full max-w-md rounded-t-3xl p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-extrabold flex items-center gap-2">
                <Disc3 size={16} className="text-gold" />
                공정성 검증
              </h2>
              <button onClick={() => setShowFair(false)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <dl className="flex flex-col gap-3 text-xs">
              <FairRow k="서버 시드 (해시)">
                <code className="break-all text-[10px] text-(--color-cyan)">
                  {commit || "로딩 중..."}
                </code>
              </FairRow>
              <FairRow k="클라이언트 시드">
                <code className="text-(--color-purple)">{CLIENT_SEED}</code>
              </FairRow>
              <FairRow k="다음 라운드 번호">
                <code className="font-numeric">{nonce}</code>
              </FairRow>
              <FairRow k="위험도 / 세그먼트">
                <code className="font-numeric text-gold">
                  {risk} / {segments}
                </code>
              </FairRow>
              <FairRow k="평균 배수 (엔진 RTP)">
                <code className="font-numeric text-emerald">{avgMult.toFixed(4)}x</code>
              </FairRow>
            </dl>
            <p className="mt-4 text-[10px] leading-relaxed text-(--color-muted)">
              결과 인덱스 = floor(u × segments), u = floatFromBytes(HMAC-SHA256(serverSeed,
              &quot;clientSeed:nonce:0&quot;)). 배수 테이블은 위 평균값으로 검증 가능합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function FairRow({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-(--color-muted)">{k}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

/** SVG ring 세그먼트 path 빌더. 0번 세그먼트는 12시(top)에서 시작해 시계방향으로 진행. */
function buildSegmentPaths(count: number): string[] {
  const cx = WHEEL_SIZE / 2;
  const cy = WHEEL_SIZE / 2;
  const rOuter = WHEEL_SIZE / 2 - 4;
  const rInner = rOuter - STROKE;
  const per = (Math.PI * 2) / count;
  const paths: string[] = [];
  for (let i = 0; i < count; i++) {
    // 12시(상단) = -π/2 기준, 시계 방향
    const a0 = -Math.PI / 2 + i * per;
    const a1 = a0 + per;
    const x0o = cx + rOuter * Math.cos(a0);
    const y0o = cy + rOuter * Math.sin(a0);
    const x1o = cx + rOuter * Math.cos(a1);
    const y1o = cy + rOuter * Math.sin(a1);
    const x1i = cx + rInner * Math.cos(a1);
    const y1i = cy + rInner * Math.sin(a1);
    const x0i = cx + rInner * Math.cos(a0);
    const y0i = cy + rInner * Math.sin(a0);
    const large = per > Math.PI ? 1 : 0;
    paths.push(
      [
        `M ${x0o} ${y0o}`,
        `A ${rOuter} ${rOuter} 0 ${large} 1 ${x1o} ${y1o}`,
        `L ${x1i} ${y1i}`,
        `A ${rInner} ${rInner} 0 ${large} 0 ${x0i} ${y0i}`,
        "Z",
      ].join(" "),
    );
  }
  return paths;
}
