/**
 * DiceScreen — GA-F server authority + legacy PF fallback.
 *
 * Server path (GA-F): dice_place_v1 instant settle → client animation only.
 *
 * nonce: server path uses next_nonce from RPC; legacy idle → nonce++.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { DiceSlider } from "@/shared/games/dice/DiceSlider";
import { DiceResultDisplay } from "@/shared/games/dice/DiceResultDisplay";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { HistoryPillStrip } from "@/shared/games/ui/HistoryPillStrip";
import { ProvablyFairModal, type ProvablyFairRow } from "@/shared/games/ui/ProvablyFairModal";
import { PfVerifyPageLink } from "@/shared/games/ui/PfVerifyPageLink";
import { PF_BLOCK_ACTIVE_ROUND_MSG } from "@/shared/games/ui/pfPolicy";
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { DICE_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { liveFeedBetIdForRound } from "@/lib/api/liveFeedMap";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import {
  type DiceMode,
  isWin,
  payoutMultiplier,
  winChance,
} from "@/shared/games/dice/DiceEngine";
import { usePfSession } from "@/shared/games/hooks/usePfSession";
import { useGameAuthorityFlag } from "@/shared/games/hooks/useGameAuthorityFlag";
import {
  type ActiveDiceRound,
  diceStore,
} from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { useAuth } from "@/features/auth/AuthContext";
import { diceComplete, dicePlace } from "@/lib/api/diceSession";
import { getGameActiveSession } from "@/lib/api/gameSessions";
import { toIntegerPhonAmount } from "@/lib/api/walletSchemas";
import {
  activeDiceRoundFromSession,
  isDiceSessionConflict,
} from "@/lib/gameSessions/diceSessionUtils";
import { fetchRealSession } from "@/shared/games/gameSessionHelpers";
import { syncRealBalance } from "@/shared/wallet/walletStore";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode, useRegisterRightRail } from "@/shared/layout/useGameLayout";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { notifyPfSeedChanged } from "@/shared/games/ui/gameOutcomePolicy";
import { appToast } from "@/shared/ui/toast";
import { DiceRightRail } from "./DiceRightRail";

const LEGACY_PF_SEED = "phonara-dice-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";
const ROLLING_MS = 800;
const SETTLED_MS = 800;

type ActiveBet = {
  amount: number;
  target: number;
  mode: DiceMode;
  liveBetId: string;
  nonce: number;
  serverSide?: boolean;
  roll?: number;
  won?: boolean;
  payoutMultiplier?: number;
  nextNonce?: number;
  betMode?: "demo" | "real";
};

export function DiceScreen() {
  useRegisterMainMode("game");
  const { status: authStatus } = useAuth();
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = diceStore.use((s) => s.nonce);
  const history = diceStore.use((s) => s.history);
  const lastRoll = diceStore.use((s) => s.lastRoll);
  const lastOutcome = diceStore.use((s) => s.lastOutcome);
  const target = diceStore.use((s) => s.target);
  const diceMode = diceStore.use((s) => s.diceMode);
  const pendingAmount = diceStore.use((s) => s.pendingAmount);
  const storeClientSeed = diceStore.use((s) => s.clientSeed);

  const round = useGameRound({ rollingMs: ROLLING_MS, settledMs: SETTLED_MS });
  const [activeBet, setActiveBet] = useState<ActiveBet | null>(null);
  const pf = usePfSession("dice", LEGACY_PF_SEED, DEFAULT_CLIENT_SEED, {
    clientSeed: storeClientSeed || DEFAULT_CLIENT_SEED,
  });
  const diceServerFlag = useGameAuthorityFlag("dice_server_settle");
  const canUseServerAuthority =
    isSupabaseConfigured() &&
    authStatus === "authenticated" &&
    pf.ready &&
    !pf.legacyFallback &&
    diceServerFlag;
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const sfx = useSfx();
  const tickIntervalRef = useRef<number | null>(null);
  const settledRef = useRef(false);
  const restoredRef = useRef(false);
  const serverCreditDoneRef = useRef(false);
  const placeInFlightRef = useRef(false);
  const isDesktop = useDesktopLayout();
  const rightRailNode = useMemo(() => <DiceRightRail />, []);
  useRegisterRightRail(rightRailNode);

  useEffect(() => {
    if (showFair) setSeedDraft(diceStore.get().clientSeed);
  }, [showFair]);

  const hydrateDiceActiveRound = useCallback((ar: ActiveDiceRound) => {
    setActiveBet({
      amount: ar.amount,
      target: ar.target,
      mode: ar.diceMode,
      liveBetId: ar.liveBetId,
      nonce: ar.nonce,
      serverSide: ar.serverSide,
      roll: ar.roll,
      won: ar.won,
      payoutMultiplier: ar.payoutMultiplier,
      nextNonce: ar.nextNonce,
      betMode: ar.betMode,
    });
    liveBetsStore.ensureUserPending({
      id: ar.liveBetId,
      user: "나의_베팅",
      game: "dice",
      amount: ar.amount,
      multiplier: null,
      profit: null,
      status: "pending",
      mode,
      isMe: true,
    });
    round.place();
  }, [round, mode]);

  // Resume-First: server SSOT on remount (GA-F §5.2).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const applyLocal = () => {
      const ar = diceStore.get().activeRound;
      if (ar) hydrateDiceActiveRound(ar);
    };

    if (!isSupabaseConfigured() || authStatus !== "authenticated") {
      applyLocal();
      return;
    }

    void fetchRealSession("dice").then((row) => {
      if (row) {
        const local = diceStore.get().activeRound;
        const ar = activeDiceRoundFromSession(row, { liveBetId: local?.liveBetId });
        diceStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
        hydrateDiceActiveRound(ar);
        return;
      }
      applyLocal();
    }).catch(applyLocal);
  }, [authStatus, hydrateDiceActiveRound]);

  const settleFromOutcome = useCallback(
    (
      bet: ActiveBet,
      roll: number,
      won: boolean,
      pm: number,
      skipRealCredit: boolean,
    ) => {
      const profit = won ? profitOf(bet.amount, pm, mode) : -bet.amount;
      if (won && !skipRealCredit) {
        void credit(bet.amount + profit, pm, {
          game: "dice",
          roundId: `n${bet.nonce}`,
        });
      }
      diceStore.set((s) => ({
        ...s,
        lastRoll: roll,
        history: [{ id: `n${bet.nonce}`, roll, win: won }, ...s.history].slice(0, 30),
        lastOutcome: { outcome: won ? "win" : "loss", profit, nonce: bet.nonce, roll },
      }));
      liveBetsStore.settle(
        bet.liveBetId,
        {
          multiplier: won ? pm : null,
          profit: won ? +profit.toFixed(2) : -bet.amount,
          status: won ? "win" : "loss",
        },
        userLiveBetFallback("dice", bet.amount, mode),
      );
      recordSessionOutcome({
        outcome: won ? "win" : "loss",
        profit,
        multiplier: won ? pm : undefined,
      });
      sfx.play(won ? "win" : "loss");
      settledRef.current = true;
    },
    [mode, credit, sfx],
  );

  // rolling → server outcome
  useEffect(() => {
    if (round.phase !== "rolling" || !activeBet) return;
    let alive = true;
    if (tickIntervalRef.current == null) {
      tickIntervalRef.current = window.setInterval(() => sfx.play("tick"), 200);
    }

    if (activeBet.roll != null && activeBet.won != null) {
      const pm =
        activeBet.payoutMultiplier ??
        payoutMultiplier(winChance(activeBet.target, activeBet.mode));
      const skipRealCredit =
        activeBet.betMode === "real" && !!activeBet.serverSide && serverCreditDoneRef.current;
      settleFromOutcome(activeBet, activeBet.roll, activeBet.won, pm, skipRealCredit);
      return () => {
        if (tickIntervalRef.current != null) {
          window.clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
      };
    }
    return () => {
      alive = false;
      if (tickIntervalRef.current != null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [round.phase, activeBet, pf.serverSeed, settleFromOutcome]);

  // idle → clear session + nonce from server or ++
  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    const bet = activeBet;
    const roundId = bet ? `n${bet.nonce}` : null;
    if (bet?.serverSide && roundId) {
      void diceComplete(roundId);
    }
    settledRef.current = false;
    serverCreditDoneRef.current = false;
    setActiveBet(null);
    diceStore.set((s) => ({
      ...s,
      activeRound: null,
      nonce: bet?.nextNonce ?? s.nonce + 1,
    }));
  }, [round.phase, activeBet]);

  const handlePlace = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!round.isIdle || activeBet || amount <= 0 || !pf.ready) return false;
      const currentNonce = diceStore.get().nonce;
      const roundId = `n${currentNonce}`;
      const target = diceStore.get().target;
      const diceMode = diceStore.get().diceMode;

      if (canUseServerAuthority) {
        if (placeInFlightRef.current) return false;
        placeInFlightRef.current = true;
        const betAmount =
          mode === "real" ? toIntegerPhonAmount(amount) : Math.max(1, Math.round(amount));
        if (mode === "real" && betAmount == null) {
          placeInFlightRef.current = false;
          return false;
        }

        try {
          const existing = await getGameActiveSession("dice");
          if (existing) {
            const local = diceStore.get().activeRound;
            const ar = activeDiceRoundFromSession(existing, { liveBetId: local?.liveBetId });
            diceStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
            hydrateDiceActiveRound(ar);
            return true;
          }

          if (mode === "demo") {
            const ok = await tryDebit(amount, { game: "dice", roundId });
            if (!ok) return false;
          }

          const seed = diceStore.get().clientSeed || DEFAULT_CLIENT_SEED;
          const res = await dicePlace({
            amount: betAmount ?? Math.max(1, Math.round(amount)),
            roundId,
            target,
            diceMode,
            clientSeed: seed,
          });
          if (res.mode === "real") {
            serverCreditDoneRef.current = res.won;
            if (res.balance?.phon != null) syncRealBalance(res.balance.phon);
          }

          diceStore.set((s) => ({ ...s, pendingAmount: amount }));
          const liveBetId = liveBetsStore.push({
            id: liveFeedBetIdForRound("dice", roundId),
            user: "나의_베팅",
            game: "dice",
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            multiplier: null,
            profit: null,
            status: "pending",
            mode,
            isMe: true,
          });

          const ar: ActiveDiceRound = {
            nonce: currentNonce,
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            target,
            diceMode,
            liveBetId,
            placedAt: Date.now(),
            betMode: mode,
            serverSide: true,
            roll: res.roll,
            won: res.won,
            payoutMultiplier: res.payout_multiplier,
            nextNonce: currentNonce + 1,
          };
          diceStore.set((s) => ({ ...s, activeRound: ar }));
          setActiveBet({
            amount: ar.amount,
            target,
            mode: diceMode,
            liveBetId,
            nonce: currentNonce,
            serverSide: true,
            roll: res.roll,
            won: res.won,
            payoutMultiplier: res.payout_multiplier,
            nextNonce: currentNonce + 1,
            betMode: mode,
          });
          sfx.play("bet");
          round.place();
          return true;
        } catch (err) {
          if (isDiceSessionConflict(err)) {
            try {
              const row = await getGameActiveSession("dice");
              if (row) {
                const local = diceStore.get().activeRound;
                const ar = activeDiceRoundFromSession(row, { liveBetId: local?.liveBetId });
                diceStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
                hydrateDiceActiveRound(ar);
                return true;
              }
            } catch {
              /* fall through */
            }
          }
          appToast.raw.error("베팅에 실패했습니다 (진행 중 라운드가 있거나 네트워크 오류)");
          return false;
        } finally {
          placeInFlightRef.current = false;
        }
      }

      const ok = await tryDebit(amount, { game: "dice", roundId });
      if (!ok) return false;
      diceStore.set((s) => ({ ...s, pendingAmount: amount }));
      const liveBetId = liveBetsStore.push({
        id: liveFeedBetIdForRound("dice", roundId),
        user: "나의_베팅",
        game: "dice",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      setActiveBet({
        amount,
        target,
        mode: diceMode,
        liveBetId,
        nonce: currentNonce,
      });
      sfx.play("bet");
      round.place();
      return true;
    },
    [round, activeBet, mode, tryDebit, sfx, pf.ready, canUseServerAuthority, hydrateDiceActiveRound],
  );

  const setTarget = useCallback((t: number) => diceStore.set((s) => ({ ...s, target: t })), []);
  const setDiceMode = useCallback(
    (m: DiceMode) => diceStore.set((s) => ({ ...s, diceMode: m })),
    [],
  );

  const stepTarget = useCallback((delta: number) => {
    const cur = diceStore.get().target;
    const next = Math.max(1, Math.min(98, Math.round(cur + delta)));
    if (next !== cur) diceStore.set((s) => ({ ...s, target: next }));
  }, []);

  const applySeed = useCallback(() => {
    // Dice 진행 중 시드 변경 차단 (refund RPC 없음 — round < 2s)
    if (!round.isIdle || activeBet) {
      appToast.raw.error(PF_BLOCK_ACTIVE_ROUND_MSG);
      return;
    }
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    if (next === diceStore.get().clientSeed) {
      setShowFair(false);
      return;
    }
    void pf.setClientSeed(next).then(() => {
      diceStore.set((s) => ({
        ...s,
        clientSeed: next,
        nonce: 0,
        lastOutcome: null,
        lastRoll: null,
      }));
      setActiveBet(null);
      settledRef.current = false;
      diceStore.set((s) => ({ ...s, activeRound: null }));
      notifyPfSeedChanged();
      setShowFair(false);
    }).catch(() => {
      appToast.raw.error("시드 변경에 실패했습니다");
    });
  }, [seedDraft, round.isIdle, activeBet, pf]);

  const hotkeys = useMemo<HotkeyMap>(
    () => ({
      " ": (e) => {
        e.preventDefault();
        void handlePlace(diceStore.get().pendingAmount);
      },
      ArrowUp: (e) => {
        e.preventDefault();
        stepTarget(+1);
      },
      ArrowDown: (e) => {
        e.preventDefault();
        stepTarget(-1);
      },
      "Shift+ArrowUp": (e) => {
        e.preventDefault();
        stepTarget(+10);
      },
      "Shift+ArrowDown": (e) => {
        e.preventDefault();
        stepTarget(-10);
      },
      o: () => setDiceMode("over"),
      u: () => setDiceMode("under"),
      p: () => setShowFair(true),
      m: () => sfx.toggleMute(),
    }),
    [handlePlace, stepTarget, setDiceMode, sfx],
  );
  useHotkeys(hotkeys);

  const winPct = winChance(target, diceMode);
  const targetMult = payoutMultiplier(winPct);
  const outcome = round.phase === "settled" && lastOutcome ? lastOutcome.outcome : null;

  const fairRows: ProvablyFairRow[] = [
    {
      label: "서버 시드 (해시)",
      content: (
        <code className="break-all text-[10px] text-(--color-cyan)">{pf.commitHash || "로딩 중..."}</code>
      ),
      copyText: pf.commitHash || undefined,
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
    { label: "다음 라운드 번호", content: <code className="font-numeric">{nonce}</code> },
    {
      label: "마지막 결과",
      content: (
        <code className="font-numeric text-gold">
          {lastRoll != null ? lastRoll.toFixed(2) : "—"}
        </code>
      ),
    },
  ];

  return (
    <div className="mx-auto flex w-full flex-col gap-2 lg:max-w-md">
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
              <h1 className="text-xl font-extrabold leading-tight">Dice</h1>
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
        rulesCard={<GameRulesCard rules={DICE_RULES} onVerify={() => setShowFair(true)} />}
        historyStrip={
          <div className="flex flex-col gap-1.5">
            <HistoryPillStrip
              displayMode="value"
              items={history.map((h) => ({ id: h.id, multiplier: h.roll, won: h.win }))}
              onPillClick={() => setShowFair(true)}
            />
            <SessionStatsBar />
          </div>
        }
        displayArea={
          <DiceResultDisplay
            phase={round.phase as "idle" | "rolling" | "settled"}
            rollValue={lastRoll}
            outcome={outcome}
            target={target}
            diceMode={diceMode}
            payoutMultiplier={targetMult}
            winChancePct={winPct}
          />
        }
        controls={
          <div className="glass-2 rounded-2xl p-3">
            <DiceSlider
              target={target}
              mode={diceMode}
              onTargetChange={setTarget}
              onModeChange={setDiceMode}
              lastRoll={lastRoll}
              onTargetTick={() => sfx.play("tick")}
              onModeTick={() => sfx.play("bet")}
            />
          </div>
        }
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={pendingAmount}
            targetMultiplier={targetMult}
            winChancePct={winPct}
          />
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            canPlace={round.isIdle && !activeBet && pf.ready}
            hasActiveBet={false}
            balance={balance}
            lastOutcome={lastOutcome}
            showAutoTarget={false}
            bettingRoundKey={nonce}
            defaultAmount={pendingAmount}
            onAmountChange={(amount) => diceStore.set((s) => ({ ...s, pendingAmount: amount }))}
            onPlace={(amount) => handlePlace(amount)}
            onCashout={() => {}}
            serverAutoBet={{
              game: "dice",
              getBetParams: () => ({
                target: diceStore.get().target,
                dice_mode: diceStore.get().diceMode,
              }),
            }}
          />
        }
      />

      {!isDesktop && <LiveBetsFeed game="dice" limit={10} />}

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer={
          <>
            <p>시드 변경 시 nonce 0 리셋. 동일 시드/라운드는 항상 같은 결과를 만듭니다.</p>
            <PfVerifyPageLink
              game="dice"
              serverSeed={pf.serverSeed}
              serverSeedHash={pf.commitHash}
              clientSeed={seedDraft.trim() || DEFAULT_CLIENT_SEED}
              nonce={nonce}
            />
          </>
        }
      />
    </div>
  );
}
