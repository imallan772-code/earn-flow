/**
 * MinesScreen — multi-step (place → playing → settle) Stake-style Mines.
 *
 * 설계 결정 (ROUND_G_PART1_PLAN / LOVABLE_WORK_RULES)
 *  - useGameRound({ isMultiStep: true }) 사용. reveal 루프 + cashout/mine-hit → settle().
 *  - GameShell 위에 displayArea/controls/betPanel 슬롯만 주입. 비즈 로직은 화면 내 useEffect.
 *  - LiveBetsFeed는 GameShell 바깥(DiceScreen 패턴).
 *  - 베팅 시 PF로 전체 지뢰 배치 1회 확정 → 이후 reveal은 결정론적.
 *  - liveBetsStore.push(베팅) / update(cashout·hit) — Dice/Crash와 동일.
 *  - 정산: 모드별 RTP는 `houseEdge.profitOf`로 적용(엔진 RTP 99% × 모드 0.97 이중 구조).
 *
 * TODO(real-money): mineCount/배치/정산을 Edge Function으로 이전. 클라이언트는 결과 표시만.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bomb, Gem, ShieldCheck, X, Zap } from "lucide-react";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { MINES_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import {
  BOARD_SIZE,
  MAX_MINES,
  MIN_MINES,
  TOTAL_TILES,
  clampMines,
  isMine,
  nextMultiplier,
  placeMines,
} from "@/shared/games/mines/MinesEngine";
import { minesStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";

const SERVER_SEED = "phonara-mines-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";

interface ActiveBet {
  amount: number;
  mineCount: number;
  mines: number[];
  liveBetId: string;
  nonce: number;
}

export function MinesScreen() {
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = minesStore.use((s) => s.nonce);
  const history = minesStore.use((s) => s.history);
  const lastOutcome = minesStore.use((s) => s.lastOutcome);
  const mineCount = minesStore.use((s) => s.mineCount);
  const pendingAmount = minesStore.use((s) => s.pendingAmount);

  const round = useGameRound({ isMultiStep: true, settledMs: 1000 });
  const [active, setActive] = useState<ActiveBet | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [hitTile, setHitTile] = useState<number | null>(null);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const settledRef = useRef(false);

  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // settled → cleanup + nonce++
  useEffect(() => {
    if (round.phase !== "idle") return;
    if (!settledRef.current) return;
    settledRef.current = false;
    setActive(null);
    setRevealed([]);
    setHitTile(null);
    minesStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
  }, [round.phase]);

  const setMineCount = useCallback((n: number) => {
    minesStore.set((s) => ({ ...s, mineCount: clampMines(n) }));
  }, []);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const ok = await tryDebit(amount, { game: "mines", roundId: `n${nonce}` });
      if (!ok) return;
      minesStore.set((s) => ({ ...s, pendingAmount: amount }));
      const mines = await placeMines(
        { serverSeed: SERVER_SEED, clientSeed: CLIENT_SEED, nonce },
        mineCount,
      );
      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "mines",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      setActive({ amount, mineCount, mines, liveBetId, nonce });
      setRevealed([]);
      setHitTile(null);
      round.place();
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [round, mode, mineCount, nonce, tryDebit],
  );

  const handleReveal = useCallback(
    (tile: number) => {
      if (round.phase !== "playing" || !active) return;
      if (revealed.includes(tile) || hitTile != null) return;
      if (isMine(tile, active.mines)) {
        setHitTile(tile);
        liveBetsStore.update(active.liveBetId, {
          multiplier: null,
          profit: -active.amount,
          status: "loss",
        });
        minesStore.set((s) => ({
          ...s,
          history: [
            {
              id: `n${active.nonce}`,
              mineCount: active.mineCount,
              revealed: revealed.length,
              multiplier: nextMultiplier(revealed.length, active.mineCount),
              win: false,
            },
            ...s.history,
          ].slice(0, 30),
          lastOutcome: {
            outcome: "loss",
            profit: -active.amount,
            nonce: active.nonce,
            mineCount: active.mineCount,
            revealed: revealed.length,
            multiplier: nextMultiplier(revealed.length, active.mineCount),
          },
        }));
        appToast.game.lose({ amount: formatPHON(active.amount) });
        settledRef.current = true;
        round.settle();
        return;
      }
      setRevealed((r) => [...r, tile]);
    },
    [round, active, revealed, hitTile],
  );

  const currentMult = nextMultiplier(revealed.length, active?.mineCount ?? mineCount);
  const handleCashout = useCallback(() => {
    if (round.phase !== "playing" || !active || revealed.length === 0 || hitTile != null) return;
    const profit = profitOf(active.amount, currentMult, mode);
    void credit(active.amount + profit, currentMult, {
      game: "mines",
      roundId: `n${active.nonce}`,
    });
    liveBetsStore.update(active.liveBetId, {
      multiplier: currentMult,
      profit: +profit.toFixed(2),
      status: "cashout",
    });
    minesStore.set((s) => ({
      ...s,
      history: [
        {
          id: `n${active.nonce}`,
          mineCount: active.mineCount,
          revealed: revealed.length,
          multiplier: currentMult,
          win: true,
        },
        ...s.history,
      ].slice(0, 30),
      lastOutcome: {
        outcome: "win",
        profit,
        nonce: active.nonce,
        mineCount: active.mineCount,
        revealed: revealed.length,
        multiplier: currentMult,
      },
    }));
    appToast.game.cashout({ mult: currentMult.toFixed(2), amount: formatPHON(profit) });
    settledRef.current = true;
    round.settle();
  }, [round, active, revealed, hitTile, currentMult, mode, credit]);

  const tiles = useMemo(() => Array.from({ length: TOTAL_TILES }, (_, i) => i), []);
  const safeRevealable = TOTAL_TILES - mineCount;

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
              <h1 className="text-xl font-extrabold leading-tight">Mines</h1>
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
        rulesCard={<GameRulesCard rules={MINES_RULES} onVerify={() => setShowFair(true)} />}
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
            {history.length === 0 && <li className="text-[11px] text-muted-2">아직 라운드 없음</li>}
          </ul>
        }
        displayArea={
          <div className="glass-2 rounded-2xl p-3">
            <div className="mb-2 flex items-center justify-between text-[11px]">
              <span className="font-bold text-(--color-muted)">
                지뢰{" "}
                <span className="font-numeric text-(--color-rose)">
                  {active?.mineCount ?? mineCount}
                </span>
                {" · "}
                보석{" "}
                <span className="font-numeric text-emerald">
                  {revealed.length}/{safeRevealable}
                </span>
              </span>
              <span className="font-numeric font-extrabold text-gold">
                {currentMult.toFixed(2)}x
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {tiles.map((tile) => {
                const isRevealed = revealed.includes(tile);
                const isHit = hitTile === tile;
                const showAll = round.phase === "settled" || round.phase === "idle";
                const isMineRevealed = showAll && active != null && active.mines.includes(tile);
                return (
                  <button
                    key={tile}
                    onClick={() => handleReveal(tile)}
                    disabled={round.phase !== "playing" || isRevealed || hitTile != null}
                    className={cn(
                      "aspect-square rounded-lg text-xs font-extrabold transition active:scale-95",
                      isRevealed &&
                        "bg-[color-mix(in_oklab,var(--color-emerald)_25%,transparent)] text-emerald",
                      isHit &&
                        "bg-[color-mix(in_oklab,var(--color-rose)_35%,transparent)] text-(--color-rose)",
                      !isRevealed &&
                        !isHit &&
                        isMineRevealed &&
                        "bg-[color-mix(in_oklab,var(--color-rose)_18%,transparent)] text-(--color-rose) opacity-70",
                      !isRevealed &&
                        !isHit &&
                        !isMineRevealed &&
                        "bg-(--color-surface-hi) text-(--color-muted)",
                      round.phase === "playing" &&
                        !isRevealed &&
                        hitTile == null &&
                        "hover:bg-(--color-bg-2)",
                    )}
                  >
                    {isRevealed ? (
                      <Gem size={16} className="mx-auto" />
                    ) : isHit || isMineRevealed ? (
                      <Bomb size={16} className="mx-auto" />
                    ) : (
                      ""
                    )}
                  </button>
                );
              })}
            </div>
            {round.phase === "playing" && (
              <button
                onClick={handleCashout}
                disabled={revealed.length === 0 || hitTile != null}
                className={cn(
                  "mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-extrabold transition active:scale-[0.98]",
                  revealed.length > 0 && hitTile == null
                    ? "bg-warning text-(--color-bg-0) shadow-glow-gold"
                    : "bg-(--color-surface-hi) text-muted-2",
                )}
              >
                <Zap size={14} />
                캐쉬아웃 @ {currentMult.toFixed(2)}x
              </button>
            )}
          </div>
        }
        controls={
          <div className="glass-2 flex items-center gap-2 rounded-2xl p-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
              지뢰 수
            </span>
            <button
              onClick={() => setMineCount(mineCount - 1)}
              disabled={!round.isIdle || mineCount <= MIN_MINES}
              className="rounded-lg bg-(--color-surface-hi) px-3 py-1.5 text-sm font-bold disabled:opacity-40"
            >
              −
            </button>
            <span className="font-numeric flex-1 text-center text-base font-extrabold text-(--color-rose)">
              {mineCount}
            </span>
            <button
              onClick={() => setMineCount(mineCount + 1)}
              disabled={!round.isIdle || mineCount >= MAX_MINES}
              className="rounded-lg bg-(--color-surface-hi) px-3 py-1.5 text-sm font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
        }
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={pendingAmount}
            targetMultiplier={nextMultiplier(1, mineCount)}
          />
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            canPlace={round.isIdle}
            hasActiveBet={round.phase === "playing"}
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
            variant="compact"
            showAutoTarget={false}
            suppressCashoutButton
            onPlace={(amount) => {
              minesStore.set((s) => ({ ...s, pendingAmount: amount }));
              void handlePlace(amount);
            }}
            onCashout={handleCashout}
          />
        }
      />

      <LiveBetsFeed game="mines" limit={10} />

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
              <FairRow k="현재 지뢰 수">
                <code className="font-numeric text-(--color-rose)">{mineCount}</code>
              </FairRow>
            </dl>
            <p className="mt-4 text-[10px] leading-relaxed text-(--color-muted)">
              지뢰 배치 = Fisher-Yates(HMAC-SHA256(serverSeed, &quot;clientSeed:nonce:cursor&quot;))
              → 첫 {mineCount}개 인덱스. 동일 시드/라운드에 대해 항상 같은 배치가 나옵니다.
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
