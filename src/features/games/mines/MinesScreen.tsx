/**
 * MinesScreen — Stake-style 5×5 Mines, GameShell + useGameRound(multi-step).
 *
 * ROUND H "Zenith" polish
 *  - 3D flip 타일(MinesTile, memo), 호버 멀티 프리뷰(단일 absolute 툴팁 재사용),
 *    bomb shake + rose flash + 미공개 지뢰 stagger reveal, cashout glow pulse.
 *  - 키보드: 1–0 = 상단 0~9번 타일, R = 랜덤 안전 타일, C = 캐쉬아웃, ESC = PF 모달.
 *  - 햅틱: gem(8ms) / bomb(40ms). 옵셔널 체이닝 — iOS 안전.
 *  - aria-live "polite" 영역에 멀티 변동/결과 announce.
 *  - 영속성: minesStore.activeRound로 새로고침 시 동일 보드/revealed 복원.
 *    handlePlace / tryDebit / liveBetsStore.push 재호출 금지 (이중 차감 방지).
 *  - 공정성: PF 모달에서 clientSeed 변경 가능. 상수 제거. 변경 시 nonce 0 리셋 + activeRound 클리어.
 *  - 비대상: MinesEngine·houseEdge·provablyFair·GameShell·useGameRound·StakeBetPanel·wallet·supabase 미접촉.
 *
 * TODO(real-money): 지뢰 배치/정산은 Edge Function으로 이전 — 클라이언트는 결과 표시만.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { m, useReducedMotion } from "framer-motion";
import {
  ArrowLeft,
  Bomb,
  Copy,
  Dice5,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
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
  MAX_MINES,
  MIN_MINES,
  TOTAL_TILES,
  clampMines,
  isMine,
  nextMultiplier,
  placeMines,
} from "@/shared/games/mines/MinesEngine";
import {
  type ActiveMinesRound,
  minesStore,
} from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";
import { MinesTile } from "./MinesTile";

const SERVER_SEED = "phonara-mines-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";
const MINE_PRESETS = [1, 3, 5, 10, 24] as const;

interface ActiveBet {
  amount: number;
  mineCount: number;
  mines: number[];
  liveBetId: string;
  nonce: number;
}

function vibrate(ms: number) {
  if (typeof navigator === "undefined") return;
  // iOS Safari ignores — opacity-safe via optional chain
  navigator.vibrate?.(ms);
}

export function MinesScreen() {
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = minesStore.use((s) => s.nonce);
  const history = minesStore.use((s) => s.history);
  const lastOutcome = minesStore.use((s) => s.lastOutcome);
  const mineCount = minesStore.use((s) => s.mineCount);
  const pendingAmount = minesStore.use((s) => s.pendingAmount);
  const clientSeed = minesStore.use((s) => s.clientSeed);

  const round = useGameRound({ isMultiStep: true, settledMs: 1000 });
  const [active, setActive] = useState<ActiveBet | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [hitTile, setHitTile] = useState<number | null>(null);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const [hoverTile, setHoverTile] = useState<number | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const settledRef = useRef(false);
  const restoredRef = useRef(false);
  const reduced = useReducedMotion();
  const liveRegionId = useId();
  const boardRef = useRef<HTMLDivElement | null>(null);

  // ───────── PF commit hash
  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // ───────── Restore active round (1회) — handlePlace 재호출 금지
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const ar = minesStore.get().activeRound;
    if (!ar) return;
    setActive({
      amount: ar.amount,
      mineCount: ar.mineCount,
      mines: ar.mines,
      liveBetId: ar.liveBetId,
      nonce: ar.nonce,
    });
    setRevealed(ar.revealed);
    setHitTile(null);
    round.place();
  }, [round]);

  // ───────── settled → cleanup + nonce++
  useEffect(() => {
    if (round.phase !== "idle") return;
    if (!settledRef.current) return;
    settledRef.current = false;
    setActive(null);
    setRevealed([]);
    setHitTile(null);
    setHoverTile(null);
    minesStore.set((s) => ({ ...s, nonce: s.nonce + 1, activeRound: null }));
  }, [round.phase]);

  const setMineCount = useCallback((n: number) => {
    minesStore.set((s) => ({ ...s, mineCount: clampMines(n) }));
  }, []);

  // ───────── Place
  const handlePlace = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const ok = await tryDebit(amount, { game: "mines", roundId: `n${nonce}` });
      if (!ok) return;
      minesStore.set((s) => ({ ...s, pendingAmount: amount }));
      const seed = minesStore.get().clientSeed || DEFAULT_CLIENT_SEED;
      const mines = await placeMines(
        { serverSeed: SERVER_SEED, clientSeed: seed, nonce },
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
      const activeRound: ActiveMinesRound = {
        nonce,
        amount,
        mineCount,
        mines,
        revealed: [],
        liveBetId,
        placedAt: Date.now(),
      };
      minesStore.set((s) => ({ ...s, activeRound }));
      setActive({ amount, mineCount, mines, liveBetId, nonce });
      setRevealed([]);
      setHitTile(null);
      round.place();
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [round, mode, mineCount, nonce, tryDebit],
  );

  // ───────── Reveal one tile
  const handleReveal = useCallback(
    (tile: number) => {
      if (round.phase !== "playing" || !active) return;
      if (revealed.includes(tile) || hitTile != null) return;
      if (isMine(tile, active.mines)) {
        setHitTile(tile);
        setShakeKey((k) => k + 1);
        setFlashKey((k) => k + 1);
        vibrate(40);
        liveBetsStore.update(active.liveBetId, {
          multiplier: null,
          profit: -active.amount,
          status: "loss",
        });
        // bomb hit → 같은 tick에 activeRound: null (새로고침 시 bomb 미복원)
        minesStore.set((s) => ({
          ...s,
          activeRound: null,
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
      const nextRevealed = [...revealed, tile];
      setRevealed(nextRevealed);
      vibrate(8);
      // 진행중 라운드에 revealed 누적
      minesStore.set((s) =>
        s.activeRound
          ? { ...s, activeRound: { ...s.activeRound, revealed: nextRevealed } }
          : s,
      );
    },
    [round, active, revealed, hitTile],
  );

  const currentMult = nextMultiplier(revealed.length, active?.mineCount ?? mineCount);
  const safeRevealable = TOTAL_TILES - (active?.mineCount ?? mineCount);
  // 다음 픽 승률 (정확식): (25 - M - r) / (25 - r)
  const nextSafeChance = useMemo(() => {
    const M = active?.mineCount ?? mineCount;
    const r = revealed.length;
    const denom = TOTAL_TILES - r;
    if (denom <= 0) return 0;
    return Math.max(0, (TOTAL_TILES - M - r) / denom);
  }, [active, mineCount, revealed]);
  const nextMultPreview = useMemo(
    () => nextMultiplier(revealed.length + 1, active?.mineCount ?? mineCount),
    [active, mineCount, revealed],
  );

  // ───────── Cashout
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
      activeRound: null,
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

  // ───────── Random pick (debounced via guard — single fire per phase tick)
  const randomLockRef = useRef(false);
  const handleRandomPick = useCallback(() => {
    if (round.phase !== "playing" || !active || hitTile != null) return;
    if (randomLockRef.current) return;
    randomLockRef.current = true;
    setTimeout(() => {
      randomLockRef.current = false;
    }, 200);
    const candidates: number[] = [];
    for (let i = 0; i < TOTAL_TILES; i++) {
      if (!revealed.includes(i) && !active.mines.includes(i)) candidates.push(i);
    }
    // 안전 후보 없으면 미공개 중 1개 (bomb 가능 — 결정론적 RNG 미사용, 비공개 UX 보조)
    if (candidates.length === 0) {
      for (let i = 0; i < TOTAL_TILES; i++) {
        if (!revealed.includes(i)) candidates.push(i);
      }
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    handleReveal(pick);
  }, [round.phase, active, revealed, hitTile, handleReveal]);

  // ───────── Keyboard: 1–0, R, C
  useEffect(() => {
    if (round.phase !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      // ignore typing in inputs
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA")) return;
      if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleCashout();
        return;
      }
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        handleRandomPick();
        return;
      }
      // digits: '1'..'9' → 0..8, '0' → 9
      if (e.key >= "0" && e.key <= "9") {
        const idx = e.key === "0" ? 9 : Number(e.key) - 1;
        e.preventDefault();
        handleReveal(idx);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [round.phase, handleReveal, handleCashout, handleRandomPick]);

  // ───────── Tile-index list (stable)
  const tiles = useMemo(() => Array.from({ length: TOTAL_TILES }, (_, i) => i), []);

  // ───────── PF: change client seed
  const [seedDraft, setSeedDraft] = useState("");
  useEffect(() => {
    if (showFair) setSeedDraft(clientSeed);
  }, [showFair, clientSeed]);
  const applySeed = useCallback(() => {
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    if (next === clientSeed) {
      setShowFair(false);
      return;
    }
    minesStore.set((s) => ({
      ...s,
      clientSeed: next,
      nonce: 0,
      activeRound: null,
      lastOutcome: null,
    }));
    setActive(null);
    setRevealed([]);
    setHitTile(null);
    settledRef.current = false;
    appToast.game.bet({ amount: "시드 변경됨 · nonce 0 리셋" });
    setShowFair(false);
  }, [seedDraft, clientSeed]);
  const copyToClipboard = useCallback((text: string, label: string) => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard.writeText(text).then(() => {
      appToast.game.bet({ amount: `${label} 복사됨` });
    });
  }, []);

  // ───────── Hover tooltip position (single absolute)
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const onTileHover = useCallback(
    (idx: number | null) => {
      setHoverTile(idx);
      if (idx == null) {
        setTipPos(null);
        return;
      }
      const board = boardRef.current;
      if (!board) return;
      const cell = board.querySelector<HTMLElement>(`[data-tile="${idx}"]`);
      if (!cell) return;
      const cr = cell.getBoundingClientRect();
      const br = board.getBoundingClientRect();
      setTipPos({ x: cr.left - br.left + cr.width / 2, y: cr.top - br.top });
    },
    [],
  );

  const announce = useMemo(() => {
    if (hitTile != null) return `지뢰 폭발. 배수 0. 손실 ${formatPHON(active?.amount ?? 0)}.`;
    if (revealed.length === 0) return "베팅 대기 중.";
    return `안전 ${revealed.length}/${safeRevealable}. 현재 배수 ${currentMult.toFixed(2)}배.`;
  }, [hitTile, revealed.length, safeRevealable, currentMult, active]);

  // ───────── Render
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
            {/* Info bar */}
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
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
                {" · "}
                다음 승률{" "}
                <span className="font-numeric text-(--color-cyan)">
                  {(nextSafeChance * 100).toFixed(1)}%
                </span>
              </span>
              <span className="font-numeric font-extrabold text-gold">
                {currentMult.toFixed(2)}x
              </span>
            </div>

            {/* Board */}
            <m.div
              key={shakeKey}
              ref={boardRef}
              animate={
                shakeKey && !reduced
                  ? { x: [0, -4, 4, -3, 3, 0] }
                  : { x: 0 }
              }
              transition={{ duration: 0.16 }}
              className="relative"
            >
              <div className="grid grid-cols-5 gap-1.5" role="grid" aria-label="Mines 보드 5x5">
                {tiles.map((tile) => {
                  const isRevealed = revealed.includes(tile);
                  const isHit = hitTile === tile;
                  const showAll = round.phase === "settled" || (round.phase === "idle" && hitTile != null);
                  const isMineRevealed =
                    showAll && active != null && active.mines.includes(tile) && !isHit;
                  return (
                    <div key={tile} data-tile={tile} className="contents">
                      <MinesTile
                        index={tile}
                        isRevealed={isRevealed}
                        isHit={isHit}
                        isMineRevealed={isMineRevealed}
                        playing={round.phase === "playing" && hitTile == null}
                        onReveal={handleReveal}
                        onHoverPreview={onTileHover}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Rose flash on bomb hit */}
              {flashKey > 0 && !reduced && (
                <m.div
                  key={flashKey}
                  initial={{ opacity: 0.4 }}
                  animate={{ opacity: 0 }}
                  transition={{ duration: 0.24 }}
                  className="pointer-events-none absolute inset-0 rounded-xl bg-[color-mix(in_oklab,var(--color-rose)_60%,transparent)]"
                />
              )}

              {/* Hover multiplier tooltip — single floating element */}
              {hoverTile != null &&
                tipPos != null &&
                round.phase === "playing" &&
                !revealed.includes(hoverTile) &&
                hitTile == null && (
                  <div
                    className="font-numeric pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-(--color-bg-0)/90 px-2 py-1 text-[10px] font-extrabold text-gold shadow-glow-gold ring-1 ring-gold/30"
                    style={{ left: tipPos.x, top: tipPos.y - 6 }}
                  >
                    +{nextMultPreview.toFixed(2)}x
                  </div>
                )}
            </m.div>

            {/* Cashout button */}
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

            {/* Hotkey hint */}
            <p className="mt-2 text-center text-[10px] text-muted-2">
              1–0 = 상단 10칸 / R 랜덤 / C 캐쉬아웃
            </p>

            {/* aria-live announcer */}
            <span id={liveRegionId} aria-live="polite" className="sr-only">
              {announce}
            </span>
          </div>
        }
        controls={
          <div className="glass-2 flex flex-col gap-2 rounded-2xl p-3">
            <div className="flex items-center gap-2">
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
              {round.phase === "playing" && (
                <button
                  onClick={handleRandomPick}
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
                  onClick={() => setMineCount(p)}
                  disabled={!round.isIdle}
                  className={cn(
                    "font-numeric shrink-0 rounded-full px-3 py-1 text-[11px] font-extrabold transition",
                    mineCount === p
                      ? "bg-warning text-(--color-bg-0) shadow-glow-gold ring-2 ring-gold"
                      : "bg-(--color-surface-hi) text-(--color-muted) hover:bg-bg-2",
                    !round.isIdle && "opacity-50",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
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
        <FairModal
          commit={commit}
          clientSeed={clientSeed}
          seedDraft={seedDraft}
          setSeedDraft={setSeedDraft}
          nonce={nonce}
          mineCount={mineCount}
          onApply={applySeed}
          onClose={() => setShowFair(false)}
          onCopy={copyToClipboard}
        />
      )}
    </div>
  );
}

// ───────── PF Modal (focus trap + ESC)
interface FairModalProps {
  commit: string;
  clientSeed: string;
  seedDraft: string;
  setSeedDraft: (s: string) => void;
  nonce: number;
  mineCount: number;
  onApply: () => void;
  onClose: () => void;
  onCopy: (text: string, label: string) => void;
}

function FairModal({
  commit,
  clientSeed,
  seedDraft,
  setSeedDraft,
  nonce,
  mineCount,
  onApply,
  onClose,
  onCopy,
}: FairModalProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      // simple focus trap between first input and close button
      const root = containerRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const verifySnippet = `// MinesEngine Fisher-Yates 검증
const input = { serverSeed: "<공개된 서버 시드>", clientSeed: "${clientSeed}", nonce: ${nonce} };
await placeMines(input, ${mineCount});`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="공정성 검증"
    >
      <div
        ref={containerRef}
        className="glass-2 w-full max-w-md rounded-t-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-extrabold">
            <Sparkles size={16} className="text-gold" />
            공정성 검증
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <dl className="flex flex-col gap-3 text-xs">
          <FairRow k="서버 시드 (해시)">
            <div className="flex items-center justify-end gap-1.5">
              <code className="break-all text-[10px] text-(--color-cyan)">
                {commit || "로딩 중..."}
              </code>
              {commit && (
                <button
                  onClick={() => onCopy(commit, "해시")}
                  className="shrink-0 rounded-md bg-(--color-surface-hi) p-1.5 hover:bg-bg-2"
                  aria-label="해시 복사"
                >
                  <Copy size={11} />
                </button>
              )}
            </div>
          </FairRow>
          <FairRow k="클라이언트 시드">
            <input
              ref={inputRef}
              value={seedDraft}
              onChange={(e) => setSeedDraft(e.target.value)}
              maxLength={32}
              placeholder={DEFAULT_CLIENT_SEED}
              className="font-numeric w-full rounded-lg bg-(--color-surface-hi) px-2 py-1 text-right text-[11px] text-(--color-purple) outline-none focus-visible:ring-2 focus-visible:ring-gold"
            />
          </FairRow>
          <FairRow k="다음 라운드 번호">
            <code className="font-numeric">{nonce}</code>
          </FairRow>
          <FairRow k="현재 지뢰 수">
            <code className="font-numeric text-(--color-rose)">{mineCount}</code>
          </FairRow>
          <FairRow k="검증 스니펫">
            <button
              onClick={() => onCopy(verifySnippet, "스니펫")}
              className="flex items-center gap-1 rounded-md bg-(--color-surface-hi) px-2 py-1 text-[10px] font-bold hover:bg-bg-2"
            >
              <Copy size={10} />
              복사
            </button>
          </FairRow>
        </dl>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl bg-(--color-surface-hi) py-2.5 text-sm font-extrabold"
          >
            취소
          </button>
          <button
            onClick={onApply}
            className="flex-1 rounded-xl bg-warning py-2.5 text-sm font-extrabold text-(--color-bg-0) shadow-glow-gold"
          >
            시드 적용
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-(--color-muted)">
          <Bomb size={10} className="mr-1 inline" />
          시드 변경 시 nonce 0 리셋 + 진행 중 라운드 폐기. 동일 시드/라운드는 항상 같은 배치를
          만듭니다.
        </p>
      </div>
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
