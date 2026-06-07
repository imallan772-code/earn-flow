/**
 * WheelScreen — GA-H server authority + legacy PF fallback.
 *
 * Server path (GA-H): wheel_place_v1 instant settle → 3200ms animation only.
 * Legacy path: offline / flag off → WheelEngine spin (unchanged).
 *
 * nonce: server path uses next_nonce from RPC; legacy place → nonce++.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { HistoryPillStrip } from "@/shared/games/ui/HistoryPillStrip";
import { ProvablyFairModal, type ProvablyFairRow } from "@/shared/games/ui/ProvablyFairModal";
import { PfVerifyPageLink } from "@/shared/games/ui/PfVerifyPageLink";
import { PF_BLOCK_ACTIVE_ROUND_MSG } from "@/shared/games/ui/pfPolicy";
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { WHEEL_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { liveFeedBetIdForRound } from "@/lib/api/liveFeedMap";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { usePfSession } from "@/shared/games/hooks/usePfSession";
import { useGameAuthorityFlag } from "@/shared/games/hooks/useGameAuthorityFlag";
import {
  expectedMultiplier,
  multiplierAt,
  spin,
  type WheelRisk,
  type WheelSegments,
} from "@/shared/games/wheel/WheelEngine";
import {
  type ActiveWheelRound,
  type WheelOutcome,
  wheelStore,
} from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { useAuth } from "@/features/auth/AuthContext";
import { wheelComplete, wheelPlace } from "@/lib/api/wheelSession";
import { getGameActiveSession } from "@/lib/api/gameSessions";
import { toIntegerPhonAmount } from "@/lib/api/walletSchemas";
import {
  activeWheelRoundFromSession,
  isWheelSessionConflict,
} from "@/lib/gameSessions/wheelSessionUtils";
import { fetchRealSession, syncRealSession } from "@/shared/games/gameSessionHelpers";
import { syncRealBalance } from "@/shared/wallet/walletStore";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { notifyPfSeedChanged } from "@/shared/games/ui/gameOutcomePolicy";
import { appToast } from "@/shared/ui/toast";
import { WheelDisplay } from "./WheelDisplay";
import { WheelControls } from "./WheelControls";
import { WheelLegend } from "./WheelLegend";
import { WheelRightRail } from "./WheelRightRail";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { useRegisterRightRail } from "@/shared/layout/useGameLayout";

const LEGACY_PF_SEED = "phonara-wheel-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";
const RISK_ORDER: readonly WheelRisk[] = ["low", "medium", "high"];

export function WheelScreen() {
  useRegisterMainMode("game");
  const { status: authStatus } = useAuth();
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = wheelStore.use((s) => s.nonce);
  const history = wheelStore.use((s) => s.history);
  const lastOutcome = wheelStore.use((s) => s.lastOutcome);
  const risk = wheelStore.use((s) => s.risk);
  const segments = wheelStore.use((s) => s.segments);
  const pendingAmount = wheelStore.use((s) => s.pendingAmount);
  const storeClientSeed = wheelStore.use((s) => s.clientSeed);
  const activeRound = wheelStore.use((s) => s.activeRound);

  const round = useGameRound({ rollingMs: 3200, settledMs: 1200 });
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [resultMult, setResultMult] = useState<number | null>(null);
  const [jackpotTrigger, setJackpotTrigger] = useState(0);
  const settledRef = useRef(false);
  const restoredRef = useRef(false);
  const serverCreditDoneRef = useRef(false);
  const placeInFlightRef = useRef(false);
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const pf = usePfSession("wheel", LEGACY_PF_SEED, DEFAULT_CLIENT_SEED, {
    clientSeed: storeClientSeed || DEFAULT_CLIENT_SEED,
  });
  const wheelServerFlag = useGameAuthorityFlag("wheel_server_settle");
  const canUseServerAuthority =
    isSupabaseConfigured() &&
    authStatus === "authenticated" &&
    pf.ready &&
    !pf.legacyFallback &&
    wheelServerFlag;
  const sfx = useSfx();
  const tickIntervalRef = useRef<number | null>(null);
  const isDesktop = useDesktopLayout();
  const rightRailNode = useMemo(() => <WheelRightRail />, []);
  useRegisterRightRail(rightRailNode);

  useEffect(() => {
    if (showFair) setSeedDraft(wheelStore.get().clientSeed);
  }, [showFair]);

  const hydrateActiveRound = useCallback(
    (ar: ActiveWheelRound) => {
      liveBetsStore.ensureUserPending({
        id: ar.liveBetId,
        user: "나의_베팅",
        game: "wheel",
        amount: ar.amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      round.place();
    },
    [round, mode],
  );

  // Resume-First: server SSOT on remount (GA-H §5.2).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const applyLocal = () => {
      const ar = wheelStore.get().activeRound;
      if (ar) hydrateActiveRound(ar);
    };

    if (!isSupabaseConfigured() || authStatus !== "authenticated") {
      applyLocal();
      return;
    }

    void fetchRealSession("wheel").then((row) => {
      if (row) {
        const local = wheelStore.get().activeRound;
        const ar = activeWheelRoundFromSession(row, { liveBetId: local?.liveBetId });
        wheelStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
        hydrateActiveRound(ar);
        return;
      }
      applyLocal();
    }).catch(applyLocal);
  }, [authStatus, hydrateActiveRound]);

  const settleFromOutcome = useCallback(
    (
      ar: ActiveWheelRound,
      idx: number,
      mult: number,
      won: boolean,
      skipRealCredit: boolean,
    ) => {
      const profit = won ? profitOf(ar.amount, mult, mode) : -ar.amount;
      setResultIndex(idx);
      setResultMult(mult);
      if (won && !skipRealCredit) {
        void credit(ar.amount + profit, mult, { game: "wheel", roundId: `n${ar.nonce}` });
      }
      const outcome: WheelOutcome = {
        outcome: won ? "win" : "loss",
        profit,
        nonce: ar.nonce,
        risk: ar.risk,
        segments: ar.segments,
        index: idx,
        multiplier: mult,
      };
      wheelStore.set((s) => ({
        ...s,
        history: [
          {
            id: `n${ar.nonce}`,
            risk: ar.risk,
            segments: ar.segments,
            index: idx,
            multiplier: mult,
            win: won,
          },
          ...s.history,
        ].slice(0, 30),
        lastOutcome: outcome,
      }));
      liveBetsStore.settle(
        ar.liveBetId,
        {
          multiplier: won ? mult : null,
          profit: won ? +profit.toFixed(2) : -ar.amount,
          status: won ? "win" : "loss",
        },
        userLiveBetFallback("wheel", ar.amount, mode),
      );
      recordSessionOutcome({
        outcome: won ? "win" : "loss",
        profit,
        multiplier: won ? mult : undefined,
      });
      sfx.play(won ? "win" : "loss");
      if (won && mult >= 9.0) {
        sfx.play("jackpot");
        setJackpotTrigger((n) => n + 1);
      }
      settledRef.current = true;
    },
    [mode, credit, sfx],
  );

  // rolling → server outcome or legacy spin
  useEffect(() => {
    if (round.phase !== "rolling") return;
    const ar = wheelStore.get().activeRound;
    if (!ar) return;
    let alive = true;

    if (tickIntervalRef.current == null) {
      tickIntervalRef.current = window.setInterval(() => sfx.play("tick"), 200);
    }

    if (
      ar.serverSide &&
      ar.spinIndex != null &&
      ar.multiplier != null &&
      ar.won != null
    ) {
      const skipRealCredit =
        ar.betMode === "real" && ar.serverSide && serverCreditDoneRef.current;
      settleFromOutcome(ar, ar.spinIndex, ar.multiplier, ar.won, skipRealCredit);
      return () => {
        if (tickIntervalRef.current != null) {
          window.clearInterval(tickIntervalRef.current);
          tickIntervalRef.current = null;
        }
      };
    }

    const seed = wheelStore.get().clientSeed || DEFAULT_CLIENT_SEED;
    void spin({ serverSeed: pf.serverSeed, clientSeed: seed, nonce: ar.nonce }, ar.segments).then(
      (idx) => {
        if (!alive) return;
        const mult = multiplierAt(ar.risk, ar.segments, idx);
        const won = mult > 0;
        settleFromOutcome(ar, idx, mult, won, false);
      },
    );
    return () => {
      alive = false;
      if (tickIntervalRef.current != null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [round.phase, pf.serverSeed, settleFromOutcome, sfx]);

  // idle → clear session + nonce from server
  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    const ar = wheelStore.get().activeRound;
    const roundId = ar ? `n${ar.nonce}` : null;
    if (ar?.serverSide && roundId) {
      void wheelComplete(roundId);
    }
    settledRef.current = false;
    serverCreditDoneRef.current = false;
    setResultIndex(null);
    setResultMult(null);
    wheelStore.set((s) => ({
      ...s,
      activeRound: null,
      nonce: ar?.nextNonce ?? s.nonce,
    }));
  }, [round.phase, activeRound]);

  const setRisk = useCallback((r: WheelRisk) => {
    wheelStore.set((s) => ({ ...s, risk: r }));
  }, []);
  const setSegmentsValue = useCallback((n: WheelSegments) => {
    wheelStore.set((s) => ({ ...s, segments: n }));
  }, []);
  const cycleRisk = useCallback((delta: number) => {
    const cur = wheelStore.get().risk;
    const idx = RISK_ORDER.indexOf(cur);
    const next = RISK_ORDER[(idx + delta + RISK_ORDER.length) % RISK_ORDER.length];
    wheelStore.set((s) => ({ ...s, risk: next }));
  }, []);

  const handlePlace = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!round.isIdle || amount <= 0 || !pf.ready || wheelStore.get().activeRound) return false;
      const currentNonce = wheelStore.get().nonce;
      const roundId = `n${currentNonce}`;
      const s0 = wheelStore.get();

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
          const existing = await getGameActiveSession("wheel");
          if (existing) {
            const local = wheelStore.get().activeRound;
            const ar = activeWheelRoundFromSession(existing, { liveBetId: local?.liveBetId });
            wheelStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
            hydrateActiveRound(ar);
            return true;
          }

          if (mode === "demo") {
            const ok = await tryDebit(amount, { game: "wheel", roundId });
            if (!ok) return false;
          }

          const seed = wheelStore.get().clientSeed || DEFAULT_CLIENT_SEED;
          const res = await wheelPlace({
            amount: betAmount ?? Math.max(1, Math.round(amount)),
            roundId,
            risk: s0.risk,
            segments: s0.segments,
            clientSeed: seed,
          });
          if (res.mode === "real") {
            serverCreditDoneRef.current = res.won;
            if (res.balance?.phon != null) syncRealBalance(res.balance.phon);
          }

          const liveBetId = liveBetsStore.push({
            id: liveFeedBetIdForRound("wheel", roundId),
            user: "나의_베팅",
            game: "wheel",
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            multiplier: null,
            profit: null,
            status: "pending",
            mode,
            isMe: true,
          });

          const ar: ActiveWheelRound = {
            nonce: currentNonce,
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            risk: res.risk,
            segments: res.segments,
            liveBetId,
            placedAt: Date.now(),
            betMode: mode,
            serverSide: true,
            spinIndex: res.spin_index,
            multiplier: res.multiplier,
            won: res.won,
            nextNonce: currentNonce + 1,
          };
          wheelStore.set((s) => ({
            ...s,
            pendingAmount: amount,
            activeRound: ar,
          }));
          setResultIndex(null);
          setResultMult(null);
          sfx.play("bet");
          round.place();
          return true;
        } catch (err) {
          if (isWheelSessionConflict(err)) {
            try {
              const row = await getGameActiveSession("wheel");
              if (row) {
                const local = wheelStore.get().activeRound;
                const ar = activeWheelRoundFromSession(row, { liveBetId: local?.liveBetId });
                wheelStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
                hydrateActiveRound(ar);
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

      const ok = await tryDebit(amount, { game: "wheel", roundId });
      if (!ok) return false;
      const liveBetId = liveBetsStore.push({
        id: liveFeedBetIdForRound("wheel", roundId),
        user: "나의_베팅",
        game: "wheel",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      const ar: ActiveWheelRound = {
        nonce: currentNonce,
        amount,
        risk: s0.risk,
        segments: s0.segments,
        liveBetId,
        placedAt: Date.now(),
        betMode: mode,
      };
      wheelStore.set((s) => ({
        ...s,
        nonce: s.nonce + 1,
        pendingAmount: amount,
        activeRound: ar,
      }));
      if (mode === "real") {
        syncRealSession("wheel", `n${currentNonce}`, amount, {
          nonce: currentNonce,
          risk: s0.risk,
          segments: s0.segments,
          live_bet_id: liveBetId,
          placed_at: ar.placedAt,
        });
      }
      setResultIndex(null);
      setResultMult(null);
      round.place();
      sfx.play("bet");
      return true;
    },
    [round, tryDebit, mode, sfx, pf.ready, canUseServerAuthority, hydrateActiveRound],
  );

  const applySeed = useCallback(() => {
    if (!round.isIdle || wheelStore.get().activeRound) {
      appToast.raw.error(PF_BLOCK_ACTIVE_ROUND_MSG);
      return;
    }
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    const cur = wheelStore.get().clientSeed;
    if (next === cur) {
      setShowFair(false);
      return;
    }
    void pf.setClientSeed(next).then(() => {
      wheelStore.set((s) => ({
        ...s,
        clientSeed: next,
        nonce: 0,
        lastOutcome: null,
        activeRound: null,
      }));
      setResultIndex(null);
      setResultMult(null);
      settledRef.current = false;
      notifyPfSeedChanged();
      setShowFair(false);
    }).catch(() => {
      appToast.raw.error("시드 변경에 실패했습니다");
    });
  }, [seedDraft, round.isIdle, pf]);

  const hotkeys = useMemo<HotkeyMap>(
    () => ({
      " ": (e) => {
        e.preventDefault();
        void handlePlace(wheelStore.get().pendingAmount);
      },
      ArrowLeft: (e) => {
        e.preventDefault();
        cycleRisk(-1);
      },
      ArrowRight: (e) => {
        e.preventDefault();
        cycleRisk(+1);
      },
      "1": () => setSegmentsValue(10),
      "2": () => setSegmentsValue(20),
      "3": () => setSegmentsValue(30),
      p: () => setShowFair(true),
      m: () => sfx.toggleMute(),
    }),
    [handlePlace, cycleRisk, setSegmentsValue, sfx],
  );
  useHotkeys(hotkeys);

  const avgMult = useMemo(() => expectedMultiplier(risk, segments), [risk, segments]);

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
      label: "위험도 / 세그먼트",
      content: (
        <code className="font-numeric text-gold">
          {risk} / {segments}
        </code>
      ),
    },
    {
      label: "평균 배수 (엔진 RTP)",
      content: <code className="font-numeric text-emerald">{avgMult.toFixed(4)}x</code>,
    },
  ];

  const displayRisk = activeRound?.risk ?? risk;
  const displaySegments = activeRound?.segments ?? segments;

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
          <div className="flex flex-col gap-1.5">
            <HistoryPillStrip
              items={history.map((h) => ({ id: h.id, multiplier: h.multiplier }))}
              onPillClick={() => setShowFair(true)}
            />
            {!isDesktop && <SessionStatsBar />}
          </div>
        }
        displayArea={
          <div className="flex flex-col gap-3">
            <WheelDisplay
              risk={displayRisk}
              segments={displaySegments}
              phase={round.phase as "idle" | "rolling" | "settled"}
              resultIndex={resultIndex}
              resultMultiplier={resultMult}
              jackpotTrigger={jackpotTrigger}
            />
            <WheelLegend risk={displayRisk} segments={displaySegments} />
          </div>
        }
        controls={
          <WheelControls
            risk={risk}
            segments={segments}
            disabled={!round.isIdle || !!activeRound}
            onRisk={setRisk}
            onSegments={setSegmentsValue}
          />
        }
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={activeRound?.amount ?? pendingAmount}
            targetMultiplier={Math.max(1.01, avgMult)}
          />
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            variant="full"
            showAutoTarget={false}
            canPlace={round.isIdle && !activeRound && pf.ready}
            hasActiveBet={!round.isIdle}
            bettingRoundKey={activeRound?.nonce ?? nonce}
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
            defaultAmount={pendingAmount}
            onAmountChange={(amount) => wheelStore.set((s) => ({ ...s, pendingAmount: amount }))}
            onPlace={(amount) => handlePlace(amount)}
            onCashout={() => {}}
            serverAutoBet={{
              game: "wheel",
              getBetParams: () => ({
                risk: wheelStore.get().risk,
                segments: wheelStore.get().segments,
              }),
            }}
          />
        }
      />

      {!isDesktop && <LiveBetsFeed game="wheel" limit={10} />}

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer={
          <>
            <p>
              시드 변경 시 nonce 0 리셋. 진행 중 라운드가 있으면 시드 변경 불가. 이탈 시 라운드는
              저장되어 복귀 시 이어집니다.
            </p>
            <PfVerifyPageLink
              game="wheel"
              serverSeed={pf.serverSeed}
              serverSeedHash={pf.commitHash}
              clientSeed={seedDraft.trim() || DEFAULT_CLIENT_SEED}
              nonce={nonce}
              risk={risk}
              segments={segments}
            />
          </>
        }
      />
    </div>
  );
}
