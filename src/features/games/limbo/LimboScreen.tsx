/**
 * LimboScreen — Stake-style Limbo. single-step on GameShell.
 *
 * 패턴 (MinesScreen 미러)
 *  - useGameRound({ rollingMs: 700, settledMs: 900 }) single-step
 *  - GameShell 슬롯 주입. LiveBetsFeed는 GameShell 바깥(DiceScreen 패턴).
 *  - activeBet은 화면 ref/state, 영속 데이터(nonce/history/target/lastOutcome/pendingAmount)는 limboStore.
 *  - 정산: profitOf(amount, payoutMultiplier(target), mode) — 이중 RTP.
 *  - liveBetsStore.push("limbo") / update — Dice/Mines 패턴.
 *
 * TODO(real-money): computeCrashPoint는 Edge Function 위임. 본 화면은 결과 표시만.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, TrendingUp, X } from "lucide-react";
import { m } from "framer-motion";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { LIMBO_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import {
  MAX_TARGET,
  MIN_TARGET,
  clampTarget,
  computeCrashPoint,
  isWin,
  payoutMultiplier,
  winChance,
} from "@/shared/games/limbo/LimboEngine";
import { limboStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";

const SERVER_SEED = "phonara-limbo-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";

interface ActiveBet {
  amount: number;
  target: number;
  liveBetId: string;
  nonce: number;
}

export function LimboScreen() {
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = limboStore.use((s) => s.nonce);
  const history = limboStore.use((s) => s.history);
  const lastOutcome = limboStore.use((s) => s.lastOutcome);
  const target = limboStore.use((s) => s.target);
  const pendingAmount = limboStore.use((s) => s.pendingAmount);

  const round = useGameRound({ rollingMs: 700, settledMs: 900 });
  const [active, setActive] = useState<ActiveBet | null>(null);
  const [resultCrash, setResultCrash] = useState<number | null>(null);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // rolling → compute & settle
  useEffect(() => {
    if (round.phase !== "rolling" || !active) return;
    let alive = true;
    computeCrashPoint({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonce: active.nonce,
    }).then((crash) => {
      if (!alive) return;
      const won = isWin(crash, active.target);
      const mult = payoutMultiplier(active.target);
      const profit = won ? profitOf(active.amount, mult, mode) : -active.amount;
      setResultCrash(crash);
      if (won) {
        void credit(active.amount + profit, mult, {
          game: "limbo",
          roundId: `n${active.nonce}`,
        });
      }
      limboStore.set((s) => ({
        ...s,
        history: [
          { id: `n${active.nonce}`, crashPoint: crash, target: active.target, win: won },
          ...s.history,
        ].slice(0, 30),
        lastOutcome: {
          outcome: won ? "win" : "loss",
          profit,
          nonce: active.nonce,
          crashPoint: crash,
          target: active.target,
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

  // back to idle → cleanup & nonce++
  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    settledRef.current = false;
    setActive(null);
    setResultCrash(null);
    limboStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
  }, [round.phase]);

  const setTarget = useCallback((t: number) => {
    limboStore.set((s) => ({ ...s, target: clampTarget(t) }));
  }, []);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const ok = await tryDebit(amount, { game: "limbo", roundId: `n${nonce}` });
      if (!ok) return;
      limboStore.set((s) => ({ ...s, pendingAmount: amount }));
      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "limbo",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      setActive({ amount, target, liveBetId, nonce });
      setResultCrash(null);
      round.place();
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [round, mode, target, nonce, tryDebit],
  );

  const winPct = winChance(target);
  const displayCrash = resultCrash ?? (round.phase === "rolling" ? null : lastOutcome?.crashPoint);
  const won = lastOutcome?.outcome === "win";
  const displayColor =
    round.phase === "settled" || round.phase === "idle"
      ? won
        ? "text-emerald"
        : "text-(--color-rose)"
      : "text-(--color-cyan)";

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
              <h1 className="text-xl font-extrabold leading-tight">Limbo</h1>
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
        rulesCard={<GameRulesCard rules={LIMBO_RULES} onVerify={() => setShowFair(true)} />}
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
                {h.crashPoint.toFixed(2)}x
              </li>
            ))}
            {history.length === 0 && (
              <li className="text-[11px] text-muted-2">아직 라운드 없음</li>
            )}
          </ul>
        }
        displayArea={
          <div className="glass-2 grid place-items-center rounded-2xl px-3 py-8">
            <div className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
              결과 배수
            </div>
            <m.div
              key={resultCrash ?? round.phase}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className={cn("font-numeric mt-1 text-5xl font-extrabold tabular-nums", displayColor)}
            >
              {round.phase === "rolling"
                ? "···"
                : displayCrash != null
                  ? `${displayCrash.toFixed(2)}x`
                  : `${(1.0).toFixed(2)}x`}
            </m.div>
            <div className="mt-2 flex items-center gap-1 text-[11px] text-(--color-muted)">
              <TrendingUp size={12} className="text-(--color-cyan)" />
              목표{" "}
              <span className="font-numeric font-extrabold text-gold">{target.toFixed(2)}x</span>
            </div>
          </div>
        }
        controls={
          <div className="glass-2 flex items-center gap-2 rounded-2xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
              목표 배수
            </span>
            <button
              onClick={() => setTarget(target / 2)}
              disabled={!round.isIdle}
              className="rounded-lg bg-(--color-surface-hi) px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            >
              ÷2
            </button>
            <input
              type="number"
              min={MIN_TARGET}
              max={MAX_TARGET}
              step={0.01}
              value={target}
              disabled={!round.isIdle}
              onChange={(e) => setTarget(Number(e.target.value) || MIN_TARGET)}
              className="font-numeric flex-1 rounded-lg bg-(--color-bg-0) px-2 py-1.5 text-center text-sm font-extrabold text-gold outline-none disabled:opacity-60"
            />
            <button
              onClick={() => setTarget(target * 2)}
              disabled={!round.isIdle}
              className="rounded-lg bg-(--color-surface-hi) px-3 py-1.5 text-xs font-bold disabled:opacity-40"
            >
              2×
            </button>
          </div>
        }
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={pendingAmount}
            targetMultiplier={target}
            winChancePct={winPct}
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
              limboStore.set((s) => ({ ...s, pendingAmount: amount }));
              void handlePlace(amount);
            }}
            onCashout={() => {}}
          />
        }
      />

      <LiveBetsFeed game="limbo" limit={10} />

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
              <h2 className="text-lg font-extrabold">공정성 검증</h2>
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
              <FairRow k="현재 목표 배수">
                <code className="font-numeric text-gold">{target.toFixed(2)}x</code>
              </FairRow>
            </dl>
            <p className="mt-4 text-[10px] leading-relaxed text-(--color-muted)">
              결과 배수 = floor((100 − u) / (1 − u)) / 100, u = floatFromBytes(HMAC-SHA256(serverSeed,
              &quot;clientSeed:nonce:0&quot;)). 동일 시드/라운드에 대해 항상 같은 결과가 나옵니다.
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
