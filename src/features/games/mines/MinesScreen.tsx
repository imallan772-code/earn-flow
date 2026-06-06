/**
 * MinesScreen — Stake-style 5×5 Mines, GameShell + useGameRound(multi-step).
 *
 * ROUND N "분리 & 폴리시"
 *  - 보드/툴팁/플립/shake/flash → MinesDisplay (단일 absolute 툴팁 + bomb shake + rose flash)
 *  - 지뢰 수 stepper/preset/random/cashout/HUD → MinesControls
 *  - PF 모달 → shared ProvablyFairModal (clientSeed 변경 시 nonce 0 리셋 + activeRound 클리어)
 *  - history pill → shared HistoryPillStrip (displayMode="multiplier")
 *  - SessionStatsBar / RoundResultCard / ShareResultButton / useSfx / useHotkeys 적용
 *
 * 불변식 (ROUND H 보존)
 *  - handlePlace / tryDebit / liveBetsStore.push 재호출 금지 (이중 차감 방지) — 새로고침 복원 시 호출 X
 *  - useUnmountRefund — mid-round bet 환수
 *  - minesStore.activeRound 영속 — 새로고침 시 동일 보드/revealed 복원
 *  - MinesEngine·StakeBetPanel·useGameWallet·useGameRound·persistedGameState 스키마 0-diff
 *
 * TODO(real-money): 지뢰 배치/정산은 Edge Function — 클라이언트는 결과 표시만.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bomb, ShieldCheck } from "lucide-react";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { HistoryPillStrip } from "@/shared/games/ui/HistoryPillStrip";
import { ProvablyFairModal, type ProvablyFairRow } from "@/shared/games/ui/ProvablyFairModal";
import { RoundResultCard } from "@/shared/games/ui/RoundResultCard";
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { ShareResultButton } from "@/shared/games/ui/ShareResultButton";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { MINES_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import {
  TOTAL_TILES,
  clampMines,
  isMine,
  nextMultiplier,
  placeMines,
} from "@/shared/games/mines/MinesEngine";
import { type ActiveMinesRound, minesStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { useUnmountRefund } from "@/shared/wallet/useUnmountRefund";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useSfx } from "@/shared/sfx/useSfx";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";
import { MinesDisplay } from "./MinesDisplay";
import { MinesControls } from "./MinesControls";

const SERVER_SEED = "phonara-mines-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

interface ActiveBet {
  amount: number;
  mineCount: number;
  mines: number[];
  liveBetId: string;
  nonce: number;
}

interface RecentResult {
  outcome: "win" | "loss";
  profit: number;
  mult: number;
  nonce: number;
  mineCount: number;
  revealed: number;
}

function vibrate(ms: number) {
  if (typeof navigator === "undefined") return;
  navigator.vibrate?.(ms);
}

export function MinesScreen() {
  useRegisterMainMode("game");
  const { mode, balance, tryDebit, credit, refund } = useGameWallet();
  const nonce = minesStore.use((s) => s.nonce);
  const history = minesStore.use((s) => s.history);
  const lastOutcome = minesStore.use((s) => s.lastOutcome);
  const mineCount = minesStore.use((s) => s.mineCount);
  const pendingAmount = minesStore.use((s) => s.pendingAmount);
  const clientSeed = minesStore.use((s) => s.clientSeed);

  const round = useGameRound({ isMultiStep: true, settledMs: 1000 });
  const sfx = useSfx();
  const [active, setActive] = useState<ActiveBet | null>(null);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [hitTile, setHitTile] = useState<number | null>(null);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [flashKey, setFlashKey] = useState(0);
  const [recent, setRecent] = useState<RecentResult | null>(null);
  const settledRef = useRef(false);
  const restoredRef = useRef(false);
  const liveRegionId = useId();

  // ───────── PF commit hash
  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // ───────── Refund unsettled mid-round bet on unmount (SSOT)
  useUnmountRefund(refund, () => {
    const ar = minesStore.get().activeRound;
    if (!ar) return null;
    return { amount: ar.amount, meta: { game: "mines", roundId: `n${ar.nonce}` } };
  });

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
      sfx.play("bet");
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [round, mode, mineCount, nonce, tryDebit, sfx],
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
        const mult = nextMultiplier(revealed.length, active.mineCount);
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
              multiplier: mult,
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
            multiplier: mult,
          },
        }));
        recordSessionOutcome({ outcome: "loss", profit: -active.amount });
        sfx.play("loss");
        appToast.game.lose({ amount: formatPHON(active.amount) });
        setRecent({
          outcome: "loss",
          profit: -active.amount,
          mult,
          nonce: active.nonce,
          mineCount: active.mineCount,
          revealed: revealed.length,
        });
        settledRef.current = true;
        round.settle();
        return;
      }
      const nextRevealed = [...revealed, tile];
      setRevealed(nextRevealed);
      vibrate(8);
      sfx.play("peg");
      // 진행중 라운드에 revealed 누적
      minesStore.set((s) =>
        s.activeRound ? { ...s, activeRound: { ...s.activeRound, revealed: nextRevealed } } : s,
      );
    },
    [round, active, revealed, hitTile, sfx],
  );

  const currentMult = nextMultiplier(revealed.length, active?.mineCount ?? mineCount);
  const safeRevealable = TOTAL_TILES - (active?.mineCount ?? mineCount);
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
    recordSessionOutcome({ outcome: "win", profit, multiplier: currentMult });
    sfx.play("cashout");
    if (currentMult >= 10) sfx.play("jackpot");
    appToast.game.cashout({ mult: currentMult.toFixed(2), amount: formatPHON(profit) });
    setRecent({
      outcome: "win",
      profit,
      mult: currentMult,
      nonce: active.nonce,
      mineCount: active.mineCount,
      revealed: revealed.length,
    });
    settledRef.current = true;
    round.settle();
  }, [round, active, revealed, hitTile, currentMult, mode, credit, sfx]);

  // ───────── Random pick (debounced single fire per ~200ms)
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
    if (candidates.length === 0) {
      for (let i = 0; i < TOTAL_TILES; i++) {
        if (!revealed.includes(i)) candidates.push(i);
      }
    }
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    handleReveal(pick);
  }, [round.phase, active, revealed, hitTile, handleReveal]);

  // ───────── Hotkeys: 1–0 / R / C / ESC / M
  const hotkeys = useMemo<HotkeyMap>(() => {
    const map: HotkeyMap = {
      c: (e) => {
        e.preventDefault();
        handleCashout();
      },
      r: (e) => {
        e.preventDefault();
        handleRandomPick();
      },
      Escape: () => setShowFair((v) => !v),
      m: () => sfx.toggleMute(),
    };
    for (let i = 1; i <= 9; i++) {
      const key = String(i);
      map[key] = (e) => {
        e.preventDefault();
        handleReveal(i - 1);
      };
    }
    map["0"] = (e) => {
      e.preventDefault();
      handleReveal(9);
    };
    return map;
  }, [handleReveal, handleCashout, handleRandomPick, sfx]);
  useHotkeys(hotkeys, { enabled: round.phase === "playing" || !round.isIdle ? true : true });

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
    const ar = minesStore.get().activeRound;
    if (ar) {
      void refund(ar.amount, { game: "mines", roundId: `n${ar.nonce}` }).catch(() => undefined);
      liveBetsStore.update(ar.liveBetId, {
        multiplier: null,
        profit: 0,
        status: "bust",
      });
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
  }, [seedDraft, clientSeed, refund]);

  const fairRows: ProvablyFairRow[] = useMemo(
    () => [
      {
        label: "서버 시드 (해시)",
        content: (
          <code className="break-all text-[10px] text-(--color-cyan)">
            {commit || "로딩 중..."}
          </code>
        ),
        copyText: commit || undefined,
      },
      {
        label: "클라이언트 시드",
        content: (
          <input
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            maxLength={32}
            placeholder={DEFAULT_CLIENT_SEED}
            className="font-numeric w-full rounded-lg bg-(--color-surface-hi) px-2 py-1 text-right text-[11px] text-(--color-purple) outline-none focus-visible:ring-2 focus-visible:ring-gold"
          />
        ),
      },
      {
        label: "다음 라운드 번호",
        content: <code className="font-numeric">{nonce}</code>,
      },
      {
        label: "현재 지뢰 수",
        content: <code className="font-numeric text-(--color-rose)">{mineCount}</code>,
      },
    ],
    [commit, seedDraft, nonce, mineCount],
  );

  const announce = useMemo(() => {
    if (hitTile != null) return `지뢰 폭발. 배수 0. 손실 ${formatPHON(active?.amount ?? 0)}.`;
    if (revealed.length === 0) return "베팅 대기 중.";
    return `안전 ${revealed.length}/${safeRevealable}. 현재 배수 ${currentMult.toFixed(2)}배.`;
  }, [hitTile, revealed.length, safeRevealable, currentMult, active]);

  // ───────── Render
  return (
    <div className="relative flex flex-col gap-2">
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
              type="button"
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
          <div className="flex flex-col gap-1.5">
            <HistoryPillStrip
              items={history.map((h) => ({ id: h.id, multiplier: h.multiplier, won: h.win }))}
              onPillClick={() => setShowFair(true)}
            />
            <SessionStatsBar />
          </div>
        }
        displayArea={
          <div className="glass-2 rounded-2xl p-3">
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

            <MinesDisplay
              tiles={tiles}
              revealed={revealed}
              active={active}
              hitTile={hitTile}
              shakeKey={shakeKey}
              flashKey={flashKey}
              phase={round.phase}
              nextMultPreview={nextMultPreview}
              onReveal={handleReveal}
            />

            <span id={liveRegionId} aria-live="polite" className="sr-only">
              {announce}
            </span>
          </div>
        }
        controls={
          <MinesControls
            mineCount={mineCount}
            onMineCountChange={setMineCount}
            isIdle={round.isIdle}
            isPlaying={round.phase === "playing"}
            canCashout={revealed.length > 0 && hitTile == null}
            currentMult={currentMult}
            onCashout={handleCashout}
            onRandomPick={handleRandomPick}
          />
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
            bettingRoundKey={active?.nonce ?? nonce}
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

      {recent && (
        <>
          <RoundResultCard
            outcome={recent.outcome}
            profit={recent.profit}
            multiplier={recent.mult}
            nonce={recent.nonce}
            onDone={() => setRecent(null)}
          />
          <div className="pointer-events-auto absolute right-4 top-[calc(33%+4.5rem)] z-20">
            <ShareResultButton
              renderToCanvas={(canvas, ctx) => {
                const w = canvas.width;
                const h = canvas.height;
                ctx.fillStyle =
                  recent.outcome === "win" ? "oklch(0.78 0.18 90)" : "oklch(0.62 0.2 25)";
                ctx.font = "bold 28px system-ui";
                ctx.textAlign = "center";
                ctx.fillText(recent.outcome === "win" ? "MINES WIN" : "MINES LOSS", w / 2, 60);
                ctx.fillStyle = "#fff";
                ctx.font = "bold 36px system-ui";
                ctx.fillText(`${recent.mult.toFixed(2)}x`, w / 2, h / 2 + 8);
                ctx.font = "16px system-ui";
                ctx.fillText(
                  `#${recent.nonce}  ${recent.profit >= 0 ? "+" : ""}${recent.profit.toFixed(2)}  · 💎${recent.revealed}/💣${recent.mineCount}`,
                  w / 2,
                  h - 24,
                );
              }}
            />
          </div>
        </>
      )}

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer={
          <span className="flex items-start gap-1">
            <Bomb size={10} className="mt-0.5 shrink-0" />
            시드 변경 시 nonce 0 리셋 + 진행 중 라운드 폐기. 동일 시드/라운드는 항상 같은 배치를
            만듭니다.
          </span>
        }
      />
    </div>
  );
}
