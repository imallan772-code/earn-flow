/**
 * CrashScreen — ROUND L-1. Crash 비주얼·공통 폴리시 (단일 슬롯, 4-phase 머신 유지).
 *
 * 불변 (0-diff)
 *  - CrashEngine.ts 0 diff (수학/상수/export)
 *  - StakeBetPanel props 계약: canPlace / hasActiveBet / bettingRoundKey / bettingProgress /
 *    suppressCashoutButton / onPlace / onCashout — 문자 그대로
 *  - useGameWallet / walletStore — activeRound resume on return (no unmount refund)
 *  - 4-phase 머신: betting | running | crashed | cooldown
 *  - `useGameRound` 도입 금지 (betting timer + sharedTickLoop + 4-phase 매핑 불완전)
 *
 * 동기화 규칙 (store ↔ local `bet`)
 *  - place 성공      → bet 세팅 + activeRound 세팅 (placedAt: Date.now, bettingStartedAt: 라운드
 *                       타이머 시작 시각, startedAt: 0)
 *  - running 진입    → activeRound.startedAt = performance.now() 스냅샷 store 반영
 *  - manual/auto    → activeRound.cashedAt 갱신 (store + local 동시)
 *    cashout
 *  - crashed settle → settledRef 가드 1회. activeRound=null (이중 차감 절대 금지)
 *  - 마운트 복원    → activeRound != null && 미settle 이면 bet/phase hydrate만.
 *                       tryDebit/liveBetsStore.push 0회.
 *  - PF apply       → 진행 중 미정산 베팅 있으면 차단 (Dice/Wheel 동형, refund 없음)
 *
 * 시각 필드 의미 (혼동 금지)
 *  - `placedAt`         : 베팅 클릭 시각 (Date.now). 디버깅·정렬용.
 *  - `bettingStartedAt` : betting phase 진입 시점의 performance.now() (라운드 타이머 시작).
 *  - `startedAt`        : running 진입 시점의 performance.now() (0 = 아직 betting).
 *
 * 토스트 정책 (K/J 정렬)
 *  - 시드 변경 토스트만 유지. 일반 bet/bust/cashout `appToast` 제거.
 *
 * GA-E: server-authoritative place/cashout/sync when Supabase + auth (Stake/Rollbit-grade).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CrashCanvas } from "@/shared/games/crash/CrashCanvas";
import { CrashMultiplierBadge } from "./CrashMultiplierBadge";
import {
  BETTING_MS,
  COOLDOWN_MS,
  crashElapsedMs,
  multiplierAt,
  multiplierAt6,
} from "@/shared/games/crash/CrashEngine";
import { sharedTickLoop } from "@/shared/games/engine/tickLoop";
import { GameShell } from "@/shared/games/shell/GameShell";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { HistoryPillStrip } from "@/shared/games/ui/HistoryPillStrip";
import { ProvablyFairModal, type ProvablyFairRow } from "@/shared/games/ui/ProvablyFairModal";
import { PfVerifyPageLink } from "@/shared/games/ui/PfVerifyPageLink";
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { CRASH_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { liveFeedBetIdForRound } from "@/lib/api/liveFeedMap";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf, payoutOf } from "@/shared/games/engine/houseEdge";
import { usePfSession } from "@/shared/games/hooks/usePfSession";
import { useGameAuthorityFlag } from "@/shared/games/hooks/useGameAuthorityFlag";
import { useKillSwitch } from "@/shared/games/hooks/useKillSwitch";
import { reachedTarget } from "@/shared/games/engine/clamp";
import { type ActiveCrashRound, crashStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { PF_BLOCK_ACTIVE_ROUND_MSG } from "@/shared/games/ui/pfPolicy";
import {
  clearRealSession,
  fetchRealSession,
  syncRealSession,
} from "@/shared/games/gameSessionHelpers";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode, useRegisterRightRail } from "@/shared/layout/useGameLayout";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { notifyPfSeedChanged } from "@/shared/games/ui/gameOutcomePolicy";
import { appToast } from "@/shared/ui/toast";
import { cn } from "@/lib/utils";
import { CrashRightRail } from "./CrashRightRail";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { useAuth } from "@/features/auth/AuthContext";
import {
  crashCashout,
  crashEnsureRunning,
  crashPlace,
  crashSync,
  multFromE6,
  multToE6,
} from "@/lib/api/crashSession";
import { clearGameActiveSession, getGameActiveSession } from "@/lib/api/gameSessions";
import { toIntegerPhonAmount } from "@/lib/api/walletSchemas";
import {
  activeCrashRoundFromSession,
  crashPlaceErrorMessage,
  crashSyncTerminal,
  formatCrashMultiplier,
  isCrashPermanentCashoutError,
  isCrashSessionConflict,
  isCrashSessionNotFound,
  normalizeCrashPoint,
  persistCrashPoint,
  serverCrashRoundId,
} from "@/lib/gameSessions/crashSessionUtils";
import { resolveServerCrashResume } from "@/lib/gameSessions/crashResume";
import { syncRealBalance } from "@/shared/wallet/walletStore";

const LEGACY_PF_SEED = "phonara-crash-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

type Phase = "betting" | "running" | "crashed" | "cooldown";

interface ActiveBet {
  amount: number;
  autoTarget: number;
  cashedAt: number | null;
  liveBetId: string;
}

function syncCrashSessionFromStore() {
  const ar = crashStore.get().activeRound;
  if (!ar || ar.betMode !== "real" || ar.serverSide) return;
  syncRealSession("crash", `n${ar.nonce}`, ar.amount, {
    nonce: ar.nonce,
    auto_target: ar.autoTarget,
    cashed_at: ar.cashedAt,
    live_bet_id: ar.liveBetId,
    crash_point: persistCrashPoint(ar.crashPoint, ar.serverSide),
    started_at: ar.startedAt,
    betting_started_at: ar.bettingStartedAt,
    placed_at: ar.placedAt,
  });
}

export function CrashScreen() {
  useRegisterMainMode("game");
  const { mode, balance, tryDebit, credit, refund } = useGameWallet();
  const { status: authStatus } = useAuth();

  // Persisted store reads
  const nonce = crashStore.use((s) => s.nonce);
  const history = crashStore.use((s) => s.history);
  const lastOutcome = crashStore.use((s) => s.lastOutcome);
  const pendingAmount = crashStore.use((s) => s.pendingAmount);
  const pendingTarget = crashStore.use((s) => s.pendingTarget);
  const storeClientSeed = crashStore.use((s) => s.clientSeed);

  // Local phase / round state
  const [phase, setPhase] = useState<Phase>("betting");
  const [crashPoint, setCrashPoint] = useState(1.0);
  const [startedAt, setStartedAt] = useState(0);
  const [bettingMsLeft, setBettingMsLeft] = useState(BETTING_MS);
  const [bet, setBet] = useState<ActiveBet | null>(null);
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const pf = usePfSession("crash", LEGACY_PF_SEED, DEFAULT_CLIENT_SEED, {
    clientSeed: storeClientSeed || DEFAULT_CLIENT_SEED,
  });
  const crashServerFlag = useGameAuthorityFlag("crash_server_settle");
  const killSwitch = useKillSwitch();
  const canUseServerAuthority =
    isSupabaseConfigured() &&
    authStatus === "authenticated" &&
    pf.ready &&
    !pf.legacyFallback &&
    crashServerFlag;
  const [flashKey, setFlashKey] = useState(0);
  const [restoreReady, setRestoreReady] = useState(
    !(isSupabaseConfigured() && authStatus === "authenticated"),
  );

  // Refs
  const startedAtRef = useRef(0);
  const bettingStartedAtRef = useRef(0);
  const betRef = useRef<ActiveBet | null>(null);
  betRef.current = bet;
  const settledRef = useRef(false);
  const roundTimerRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  const tickIntervalRef = useRef<number | null>(null);
  const serverCreditDoneRef = useRef(false);
  const cashoutInFlightRef = useRef(false);
  const cashoutPermanentFailRef = useRef(false);
  const placeInFlightRef = useRef(false);
  const restoreReadyRef = useRef(!(isSupabaseConfigured() && authStatus === "authenticated"));
  const sfx = useSfx();
  const isDesktop = useDesktopLayout();
  const rightRailNode = useMemo(() => <CrashRightRail />, []);
  useRegisterRightRail(rightRailNode);

  // PF modal: sync seed draft
  useEffect(() => {
    if (showFair) setSeedDraft(crashStore.get().clientSeed);
  }, [showFair]);

  const hydrateCrashActiveRound = useCallback(
    (ar: ActiveCrashRound) => {
      if (ar.cashedAt !== null) return;
      setBet({
        amount: ar.amount,
        autoTarget: ar.autoTarget,
        cashedAt: ar.cashedAt,
        liveBetId: ar.liveBetId,
      });
      liveBetsStore.ensureUserPending({
        id: ar.liveBetId,
        user: "나의_베팅",
        game: "crash",
        amount: ar.amount,
        multiplier: ar.cashedAt,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      setCrashPoint(normalizeCrashPoint(ar.crashPoint, ar.serverSide));
      bettingStartedAtRef.current = ar.bettingStartedAt || performance.now();
      if (ar.serverSide) {
        if (ar.startedAt > 0) {
          startedAtRef.current = ar.startedAt;
          setStartedAt(ar.startedAt);
          setBettingMsLeft(0);
          setPhase("running");
        } else if (ar.bettingStartedAt > 0) {
          const left = BETTING_MS - (performance.now() - ar.bettingStartedAt);
          if (left <= 0) {
            setBettingMsLeft(0);
          } else {
            setBettingMsLeft(left);
          }
          setPhase("betting");
        } else {
          bettingStartedAtRef.current = performance.now();
          setBettingMsLeft(BETTING_MS);
          setPhase("betting");
        }
        return;
      }
      if (ar.startedAt > 0) {
        startedAtRef.current = ar.startedAt;
        setStartedAt(ar.startedAt);
        setBettingMsLeft(0);
        setPhase("running");
      } else if (ar.bettingStartedAt > 0) {
        const left = BETTING_MS - (performance.now() - ar.bettingStartedAt);
        if (left <= 0) {
          const t = performance.now();
          startedAtRef.current = t;
          setStartedAt(t);
          crashStore.set((s) =>
            s.activeRound ? { ...s, activeRound: { ...s.activeRound, startedAt: t } } : s,
          );
          syncCrashSessionFromStore();
          setBettingMsLeft(0);
          setPhase("running");
        } else {
          setBettingMsLeft(left);
          setPhase("betting");
        }
      }
    },
    [mode],
  );

  const applyServerResume = useCallback(
    async (ar: ActiveCrashRound) => {
      if (!ar.serverSide || ar.cashedAt !== null) return;
      try {
        const resume = await resolveServerCrashResume(ar);
        if (resume.phase === "crashed") {
          setCrashPoint(normalizeCrashPoint(resume.crashPoint, ar.serverSide));
          setPhase("crashed");
          return;
        }
        if (resume.phase === "running") {
          startedAtRef.current = resume.startedAtMs;
          setStartedAt(resume.startedAtMs);
          setBettingMsLeft(0);
          setPhase("running");
          crashStore.set((s) =>
            s.activeRound
              ? { ...s, activeRound: { ...s.activeRound, startedAt: resume.startedAtMs } }
              : s,
          );
          return;
        }
        if (resume.phase === "betting") {
          setCrashPoint(normalizeCrashPoint(Number.POSITIVE_INFINITY, ar.serverSide));
          if (bettingStartedAtRef.current === 0) {
            bettingStartedAtRef.current = performance.now();
          }
          setPhase("betting");
          return;
        }
        if (resume.phase === "idle") {
          crashStore.set((s) => ({ ...s, activeRound: null }));
          setBet(null);
        }
      } catch {
        /* offline — local hydrate snapshot remains */
      }
    },
    [],
  );

  const settleCashoutUi = useCallback(
    (prev: ActiveBet, at: number) => {
      crashStore.set((s) =>
        s.activeRound ? { ...s, activeRound: { ...s.activeRound, cashedAt: at } } : s,
      );
      setBet({ ...prev, cashedAt: at });
      const profit = profitOf(prev.amount, at, mode);
      liveBetsStore.settle(
        prev.liveBetId,
        {
          multiplier: at,
          profit: +profit.toFixed(2),
          status: "cashout",
        },
        userLiveBetFallback("crash", prev.amount, mode),
      );
    },
    [mode],
  );

  const performServerCashout = useCallback(
    async (roundId: string, multE6: number, prev: ActiveBet, showErrorToast: boolean) => {
      try {
        const res = await crashCashout(roundId, multE6);
        const at = multFromE6(res.at_multiplier_e6);
        if (res.mode === "real") serverCreditDoneRef.current = true;
        if (res.balance?.phon != null) syncRealBalance(res.balance.phon);
        settleCashoutUi(prev, at);
        setCrashPoint(at);
        setPhase("crashed");
      } catch (err) {
        if (isCrashPermanentCashoutError(err)) {
          cashoutPermanentFailRef.current = true;
          try {
            const sync = await crashSync(roundId);
            if (sync.status === "busted" && sync.crash_point_e6 != null) {
              setCrashPoint(multFromE6(sync.crash_point_e6));
              setPhase("crashed");
              return;
            }
            if (sync.status === "idle" || sync.status === "cashed") {
              crashStore.set((s) => ({ ...s, activeRound: null }));
            }
          } catch {
            /* offline */
          }
          if (mode === "demo") {
            const at = multFromE6(multE6);
            settleCashoutUi(prev, at);
            setCrashPoint(at);
            crashStore.set((s) => ({ ...s, activeRound: null }));
            setPhase("crashed");
            return;
          }
        }
        if (showErrorToast) {
          appToast.raw.error("캐시아웃에 실패했습니다");
        }
      }
    },
    [mode, settleCashoutUi],
  );

  // activeRound persists on navigation — resume on remount (Stake-like; no unmount refund).
  // server path: game_active_sessions SSOT; legacy: localStorage.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const finishRestore = () => {
      restoreReadyRef.current = true;
      setRestoreReady(true);
    };

    const applyLocal = () => {
      const ar = crashStore.get().activeRound;
      if (ar) hydrateCrashActiveRound(ar);
      finishRestore();
    };

    if (!isSupabaseConfigured() || authStatus !== "authenticated") {
      applyLocal();
      return;
    }

    void fetchRealSession("crash")
      .then(async (row) => {
        if (row) {
          const local = crashStore.get().activeRound;
          const ar = activeCrashRoundFromSession(row, {
            autoTarget: crashStore.get().pendingTarget,
            liveBetId: local?.liveBetId,
          });
          crashStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nonce }));
          hydrateCrashActiveRound(ar);
          await applyServerResume(ar);
          finishRestore();
          return;
        }
        applyLocal();
      })
      .catch(applyLocal);
  }, [authStatus, hydrateCrashActiveRound, applyServerResume]);

  // ─── betting phase 머신 ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "betting") return;
    setCrashPoint(Number.POSITIVE_INFINITY);
    // Arm once per round window (cooldown sets ref → 0). Never reset on activeRound null —
    // spectators / pre-bet phase share the same clock; pf.serverSeed dep must not restart 5s.
    if (bettingStartedAtRef.current === 0) {
      bettingStartedAtRef.current = performance.now();
    }

    const startTs = bettingStartedAtRef.current;

    const enterRunning = (t: number) => {
      startedAtRef.current = t;
      setStartedAt(t);
      crashStore.set((s) =>
        s.activeRound ? { ...s, activeRound: { ...s.activeRound, startedAt: t } } : s,
      );
      if (!crashStore.get().activeRound?.serverSide) syncCrashSessionFromStore();
      setPhase("running");
    };

    const id = window.setInterval(() => {
      const left = BETTING_MS - (performance.now() - bettingStartedAtRef.current);
      if (left <= 0) {
        window.clearInterval(id);
        setBettingMsLeft(0);
        const active = crashStore.get().activeRound;
        const hasOpenBet = betRef.current != null;
        if (!hasOpenBet && active?.serverSide) {
          crashStore.set((s) => ({ ...s, activeRound: null }));
        }
        const serverRound =
          hasOpenBet && active?.serverSide && active.nonce === nonce ? `n${active.nonce}` : null;
        if (serverRound) {
          void crashEnsureRunning(serverRound)
            .then((startedMs) => {
              if (startedMs == null) {
                crashStore.set((s) => ({ ...s, activeRound: null }));
                setBet(null);
                return;
              }
              enterRunning(startedMs);
            })
            .catch((err) => {
              if (!isCrashSessionNotFound(err)) return;
              crashStore.set((s) => ({ ...s, activeRound: null }));
              setBet(null);
            });
        } else {
          if (active?.serverSide && active.nonce !== nonce) {
            crashStore.set((s) => ({ ...s, activeRound: null }));
            setBet(null);
          }
          enterRunning(performance.now());
        }
      } else {
        setBettingMsLeft(left);
      }
    }, 100);
    return () => {
      window.clearInterval(id);
    };
  }, [phase, nonce, pf.serverSeed]);

  // ─── server bust poll (GA-E) ──────────────────────────────────────
  const applyServerSync = useCallback(
    (sync: Awaited<ReturnType<typeof crashSync>>) => {
      const ar = crashStore.get().activeRound;
      const hasServerBet = Boolean(ar?.serverSide && betRef.current);
      if (!hasServerBet) return;
      const cashed = betRef.current?.cashedAt ?? ar?.cashedAt ?? null;
      const displayMult = multiplierAt(crashElapsedMs(startedAtRef.current));
      const terminal = crashSyncTerminal(sync, { hasServerBet, cashedAt: cashed, displayMult });
      if (terminal.kind === "continue") return;
      if (terminal.cashedOut && betRef.current) {
        settleCashoutUi(betRef.current, terminal.crashPoint);
      }
      setCrashPoint(terminal.crashPoint);
      setPhase("crashed");
    },
    [settleCashoutUi],
  );

  useEffect(() => {
    if (phase !== "running") return;
    const roundId = serverCrashRoundId(crashStore.get().activeRound, betRef.current != null);
    if (!roundId) return;
    const poll = async () => {
      try {
        const sync = await crashSync(roundId);
        applyServerSync(sync);
      } catch {
        /* network — retry next tick */
      }
    };
    void poll();
    const id = window.setInterval(() => void poll(), 200);
    return () => window.clearInterval(id);
  }, [phase, nonce, applyServerSync]);

  // ─── running phase 머신 (sharedTickLoop) ──────────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const loop = sharedTickLoop();
    if (tickIntervalRef.current == null) {
      tickIntervalRef.current = window.setInterval(() => sfx.play("tick"), 200);
    }
    const unsub = loop.subscribe(() => {
      const elapsed = crashElapsedMs(startedAtRef.current);
      const m = multiplierAt6(elapsed);
      const prev = betRef.current;
      const serverRound = serverCrashRoundId(
        crashStore.get().activeRound,
        betRef.current != null,
      );

      if (prev && prev.cashedAt === null) {
        if (reachedTarget(m, prev.autoTarget)) {
          if (serverRound) {
            if (!cashoutPermanentFailRef.current && !cashoutInFlightRef.current) {
              cashoutInFlightRef.current = true;
              void performServerCashout(serverRound, multToE6(prev.autoTarget), prev, false).finally(
                () => {
                  cashoutInFlightRef.current = false;
                },
              );
            }
          } else if (prev.autoTarget < crashPoint) {
            crashStore.set((s) =>
              s.activeRound
                ? { ...s, activeRound: { ...s.activeRound, cashedAt: prev.autoTarget } }
                : s,
            );
            syncCrashSessionFromStore();
            setBet({ ...prev, cashedAt: prev.autoTarget });
            const profit = profitOf(prev.amount, prev.autoTarget, mode);
            liveBetsStore.settle(
              prev.liveBetId,
              {
                multiplier: prev.autoTarget,
                profit: +profit.toFixed(2),
                status: "cashout",
              },
              userLiveBetFallback("crash", prev.amount, mode),
            );
          }
        }
      }
      if (!serverRound && m >= crashPoint) setPhase("crashed");
    });
    return () => {
      unsub();
      if (tickIntervalRef.current != null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [phase, crashPoint, sfx, mode, nonce, performServerCashout]);

  // ─── crashed → settle once (deps에 bet 금지) ──────────────────────
  useEffect(() => {
    if (phase !== "crashed") return;
    if (settledRef.current) return;
    settledRef.current = true;

    const activeBet = betRef.current;
    const ar = crashStore.get().activeRound;
    const amount = activeBet?.amount ?? ar?.amount;
    const liveBetId = activeBet?.liveBetId ?? ar?.liveBetId;
    const cashed = activeBet?.cashedAt ?? ar?.cashedAt ?? null;
    const feedFallback =
      amount != null && liveBetId ? userLiveBetFallback("crash", amount, mode) : undefined;

    const roundId = `n${nonce}`;
    const betMode = ar?.betMode;
    if (amount != null && liveBetId) {
      if (cashed !== null) {
        const profit = profitOf(amount, cashed, mode);
        const payout = Math.round(payoutOf(amount, cashed, mode));
        const skipRealCredit =
          ar?.serverSide === true && betMode === "real" && serverCreditDoneRef.current;
        if (!skipRealCredit) {
          void credit(payout, cashed, { game: "crash", roundId });
        }
        crashStore.set((s) => ({
          ...s,
          lastOutcome: { outcome: "win", profit, nonce },
          activeRound: null,
        }));
        recordSessionOutcome({ outcome: "win", profit, multiplier: cashed });
        sfx.play("cashout");
        liveBetsStore.settle(
          liveBetId,
          {
            multiplier: cashed,
            profit: +profit.toFixed(2),
            status: "cashout",
          },
          feedFallback,
        );
      } else {
        crashStore.set((s) => ({
          ...s,
          lastOutcome: { outcome: "loss", profit: -amount, nonce },
          activeRound: null,
        }));
        recordSessionOutcome({ outcome: "loss", profit: -amount });
        sfx.play("loss");
        setFlashKey((k) => k + 1);
        liveBetsStore.settle(
          liveBetId,
          {
            multiplier: null,
            profit: -amount,
            status: "bust",
          },
          feedFallback,
        );
      }
    } else {
      // 베팅 없이 BUST — activeRound도 null (no-op safety)
      crashStore.set((s) => (s.activeRound ? { ...s, activeRound: null } : s));
    }
    if (betMode === "real" && amount != null && ar?.serverSide !== true) {
      clearRealSession("crash", roundId);
    }
    crashStore.set((s) => ({
      ...s,
      history: [
        { id: roundId, multiplier: crashPoint },
        ...s.history.filter((h) => h.id !== roundId),
      ].slice(0, 30),
    }));
    setBet(null);

    roundTimerRef.current = window.setTimeout(() => {
      setPhase("cooldown");
      window.setTimeout(() => {
        settledRef.current = false;
        serverCreditDoneRef.current = false;
        bettingStartedAtRef.current = 0;
        crashStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
        setBettingMsLeft(BETTING_MS);
        setPhase("betting");
      }, COOLDOWN_MS - 1200);
    }, 1200);

    return () => {
      if (roundTimerRef.current != null) window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    };
  }, [phase, crashPoint, nonce, mode, credit, sfx]);

  // ─── place / cashout ──────────────────────────────────────────────
  const handlePlace = useCallback(
    async (amount: number, autoTarget: number): Promise<boolean> => {
      if (phase !== "betting" || betRef.current || amount <= 0 || !pf.ready) return false;
      const roundId = `n${nonce}`;

      if (canUseServerAuthority) {
        if (!restoreReadyRef.current || placeInFlightRef.current) return false;
        placeInFlightRef.current = true;
        const betAmount =
          mode === "real" ? toIntegerPhonAmount(amount) : Math.max(1, Math.round(amount));
        if (mode === "real" && betAmount == null) {
          placeInFlightRef.current = false;
          return false;
        }

        let debitedDemo = false;
        try {
          const existing = await getGameActiveSession("crash");
          if (existing) {
            if (existing.round_id !== roundId) {
              const staleSync = await crashSync(existing.round_id);
              if (staleSync.status === "idle") {
                await clearGameActiveSession("crash", existing.round_id);
                crashStore.set((s) => ({ ...s, activeRound: null }));
              } else {
                appToast.raw.error("이전 Crash 라운드가 진행 중입니다 — 잠시 후 다시 시도해 주세요");
                return false;
              }
            } else {
              const sync = await crashSync(existing.round_id);
              if (sync.status === "idle") {
                await clearGameActiveSession("crash", existing.round_id);
                crashStore.set((s) => ({ ...s, activeRound: null }));
              } else {
                const local = crashStore.get().activeRound;
                const ar = activeCrashRoundFromSession(existing, {
                  autoTarget,
                  liveBetId: local?.liveBetId,
                });
                crashStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nonce }));
                hydrateCrashActiveRound(ar);
                await applyServerResume(ar);
                return true;
              }
            }
          }

          if (mode === "demo") {
            const ok = await tryDebit(amount, { game: "crash", roundId });
            if (!ok) return false;
            debitedDemo = true;
          }

          const seed = crashStore.get().clientSeed || DEFAULT_CLIENT_SEED;
          const res = await crashPlace({
            amount: betAmount ?? Math.max(1, Math.round(amount)),
            roundId,
            autoTargetE6: multToE6(autoTarget),
            clientSeed: seed,
          });
          if (res.mode === "real" && res.balance?.phon != null) syncRealBalance(res.balance.phon);

          const liveBetId = liveBetsStore.push({
            id: liveFeedBetIdForRound("crash", roundId),
            user: "나의_베팅",
            game: "crash",
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            multiplier: null,
            profit: null,
            status: "pending",
            mode,
            isMe: true,
          });

          const ar: ActiveCrashRound = {
            nonce,
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            autoTarget,
            cashedAt: null,
            liveBetId,
            placedAt: Date.now(),
            crashPoint: persistCrashPoint(Number.POSITIVE_INFINITY, true),
            startedAt: 0,
            bettingStartedAt:
              bettingStartedAtRef.current > 0 ? bettingStartedAtRef.current : performance.now(),
            betMode: mode,
            serverSide: true,
          };
          crashStore.set((s) => ({
            ...s,
            pendingAmount: amount,
            pendingTarget: autoTarget,
            activeRound: ar,
          }));
          setBet({
            amount: ar.amount,
            autoTarget,
            cashedAt: null,
            liveBetId,
          });
          setBettingMsLeft(
            Math.max(0, BETTING_MS - (performance.now() - bettingStartedAtRef.current)),
          );
          const bettingLeft = BETTING_MS - (performance.now() - bettingStartedAtRef.current);
          if (bettingLeft <= 0) {
            void crashEnsureRunning(roundId)
              .then((startedMs) => {
                if (startedMs == null) {
                  crashStore.set((s) => ({ ...s, activeRound: null }));
                  setBet(null);
                  return;
                }
                startedAtRef.current = startedMs;
                setStartedAt(startedMs);
                crashStore.set((s) =>
                  s.activeRound
                    ? { ...s, activeRound: { ...s.activeRound, startedAt: startedMs } }
                    : s,
                );
                setBettingMsLeft(0);
                setPhase("running");
              })
              .catch((err) => {
                if (!isCrashSessionNotFound(err)) return;
                crashStore.set((s) => ({ ...s, activeRound: null }));
                setBet(null);
              });
          }
          cashoutPermanentFailRef.current = false;
          sfx.play("bet");
          return true;
        } catch (err) {
          if (isCrashSessionConflict(err)) {
            try {
              const row = await getGameActiveSession("crash");
              if (row) {
                const local = crashStore.get().activeRound;
                const ar = activeCrashRoundFromSession(row, {
                  autoTarget,
                  liveBetId: local?.liveBetId,
                });
                crashStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nonce }));
                hydrateCrashActiveRound(ar);
                return true;
              }
            } catch {
              /* fall through */
            }
          }
          if (debitedDemo) {
            void refund(amount, { game: "crash", roundId, betMode: "demo" });
          }
          appToast.raw.error(crashPlaceErrorMessage(err));
          return false;
        } finally {
          placeInFlightRef.current = false;
        }
      }

      const ok = await tryDebit(amount, { game: "crash", roundId });
      if (!ok) return false;
      const liveBetId = liveBetsStore.push({
        id: liveFeedBetIdForRound("crash", roundId),
        user: "나의_베팅",
        game: "crash",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      const ar: ActiveCrashRound = {
        nonce,
        amount,
        autoTarget,
        cashedAt: null,
        liveBetId,
        placedAt: Date.now(),
        crashPoint: persistCrashPoint(crashPoint, false),
        startedAt: 0,
        bettingStartedAt:
          bettingStartedAtRef.current > 0 ? bettingStartedAtRef.current : performance.now(),
        betMode: mode,
      };
      crashStore.set((s) => ({
        ...s,
        pendingAmount: amount,
        pendingTarget: autoTarget,
        activeRound: ar,
      }));
      setBet({ amount, autoTarget, cashedAt: null, liveBetId });
      cashoutPermanentFailRef.current = false;
      syncCrashSessionFromStore();
      sfx.play("bet");
      return true;
    },
    [phase, mode, tryDebit, refund, nonce, crashPoint, sfx, pf.ready, canUseServerAuthority, hydrateCrashActiveRound, applyServerResume],
  );

  const onStakePlace = useCallback(
    (amount: number, autoTarget: number) => {
      crashStore.set((s) => ({ ...s, pendingAmount: amount, pendingTarget: autoTarget }));
      return handlePlace(amount, autoTarget);
    },
    [handlePlace],
  );

  const handleCashout = useCallback(() => {
    if (phase !== "running" || !betRef.current || betRef.current.cashedAt !== null) return;
    const elapsed = crashElapsedMs(startedAtRef.current);
    const m = multiplierAt6(elapsed);
    const prev = betRef.current;
    const serverRound = serverCrashRoundId(
      crashStore.get().activeRound,
      betRef.current != null,
    );

    if (serverRound) {
      if (cashoutPermanentFailRef.current || cashoutInFlightRef.current) return;
      cashoutInFlightRef.current = true;
      void (async () => {
        let multE6 = multToE6(m);
        try {
          const sync = await crashSync(serverRound);
          if (sync.status === "running" && sync.current_multiplier_e6 != null) {
            multE6 = sync.current_multiplier_e6;
          }
        } catch {
          /* fall back to client clock */
        }
        await performServerCashout(serverRound, multE6, prev, true);
      })().finally(() => {
        cashoutInFlightRef.current = false;
      });
      return;
    }

    crashStore.set((s) =>
      s.activeRound ? { ...s, activeRound: { ...s.activeRound, cashedAt: m } } : s,
    );
    syncCrashSessionFromStore();
    setBet((b) => (b ? { ...b, cashedAt: m } : b));
    const profit = profitOf(prev.amount, m, mode);
    liveBetsStore.settle(
      prev.liveBetId,
      {
        multiplier: m,
        profit: +profit.toFixed(2),
        status: "cashout",
      },
      userLiveBetFallback("crash", prev.amount, mode),
    );
  }, [phase, mode, performServerCashout]);

  const getCurrentMultiplier = useCallback(() => {
    const cashed = betRef.current?.cashedAt;
    if (phase !== "running") return cashed ?? bet?.cashedAt ?? 1.0;
    if (cashed != null) return cashed;
    return multiplierAt(crashElapsedMs(startedAtRef.current));
  }, [phase, bet?.cashedAt]);

  // ─── PF seed 적용 — 진행 중 미정산 베팅 있으면 차단 ───────────────
  const applySeed = useCallback(() => {
    const ar = crashStore.get().activeRound;
    if (ar && ar.cashedAt === null) {
      appToast.raw.error(PF_BLOCK_ACTIVE_ROUND_MSG);
      return;
    }
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    const cur = crashStore.get().clientSeed;
    if (next === cur) {
      setShowFair(false);
      return;
    }
    void pf.setClientSeed(next).then(() => {
      crashStore.set((s) => ({
        ...s,
        clientSeed: next,
        nonce: 0,
        lastOutcome: null,
      }));
      setBet(null);
      settledRef.current = false;
      bettingStartedAtRef.current = 0;
      if (roundTimerRef.current != null) {
        window.clearTimeout(roundTimerRef.current);
        roundTimerRef.current = null;
      }
      setBettingMsLeft(BETTING_MS);
      setPhase("betting");
      notifyPfSeedChanged();
      setShowFair(false);
    }).catch(() => {
      appToast.raw.error("시드 변경에 실패했습니다");
    });
  }, [seedDraft, pf]);

  // ─── Hotkeys ──────────────────────────────────────────────────────
  // Space는 즉시 베팅. C/Enter는 BetSummaryPanel 내부에서 keydown hold 처리.
  const hotkeys = useMemo<HotkeyMap>(
    () => ({
      " ": (e) => {
        e.preventDefault();
        if (phase !== "betting" || bet) return;
        void handlePlace(pendingAmount, pendingTarget);
      },
      p: () => setShowFair(true),
      P: () => setShowFair(true),
      m: () => sfx.toggleMute(),
      M: () => sfx.toggleMute(),
    }),
    [phase, bet, handlePlace, pendingAmount, pendingTarget, sfx],
  );
  useHotkeys(hotkeys);

  const bettingProgress = phase === "betting" ? 1 - bettingMsLeft / BETTING_MS : undefined;

  // ─── PF rows ──────────────────────────────────────────────────────
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
      label: "현재 라운드 결과",
      content: (
        <code className="font-numeric text-gold">
          {phase === "crashed" || phase === "cooldown"
            ? formatCrashMultiplier(
                crashPoint,
                crashStore.get().activeRound?.serverSide,
              )
            : "진행 중"}
        </code>
      ),
    },
  ];

  const canPlaceBet =
    phase === "betting" &&
    !bet &&
    pf.ready &&
    restoreReady &&
    !killSwitch.killSwitch &&
    !killSwitch.loading;

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
              <h1 className="text-xl font-extrabold leading-tight">Crash</h1>
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
        rulesCard={<GameRulesCard rules={CRASH_RULES} onVerify={() => setShowFair(true)} />}
        historyStrip={
          <div className="flex flex-col gap-1.5">
            <HistoryPillStrip
              items={history.map((h) => ({ id: h.id, multiplier: h.multiplier }))}
              onPillClick={() => setShowFair(true)}
            />
            <SessionStatsBar />
          </div>
        }
        displayArea={
          <div
            className={cn(
              "relative aspect-5/4 w-full overflow-hidden rounded-2xl border border-(--color-border)",
              phase === "crashed" && "animate-crash-shake",
            )}
          >
            <CrashCanvas
              phase={phase}
              startedAt={startedAt}
              crashPoint={crashPoint}
              bettingMsLeft={bettingMsLeft}
            />
            <CrashMultiplierBadge
              phase={phase}
              crashPoint={crashPoint}
              getCurrentMultiplier={getCurrentMultiplier}
            />
            {phase === "crashed" && (
              <div
                key={flashKey}
                className="animate-crash-flash pointer-events-none absolute inset-0 bg-(--color-rose)"
                aria-hidden
              />
            )}
          </div>
        }
        summaryPanel={
          bet ? (
            <BetSummaryPanel
              variant="live"
              amount={bet.amount}
              targetMultiplier={bet.autoTarget}
              getCurrentMultiplier={getCurrentMultiplier}
              busted={false}
              cashedAt={bet.cashedAt}
              onCashout={bet.cashedAt === null ? handleCashout : undefined}
            />
          ) : (
            <BetSummaryPanel
              variant="static"
              amount={pendingAmount}
              targetMultiplier={pendingTarget}
            />
          )
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            canPlace={canPlaceBet}
            hasActiveBet={!!bet && bet.cashedAt === null && phase === "running"}
            balance={balance}
            lastOutcome={lastOutcome}
            bettingRoundKey={nonce}
            bettingProgress={bettingProgress}
            suppressCashoutButton
            defaultAmount={pendingAmount}
            defaultTarget={pendingTarget}
            onAmountChange={(amount) => crashStore.set((s) => ({ ...s, pendingAmount: amount }))}
            onTargetChange={(target) => crashStore.set((s) => ({ ...s, pendingTarget: target }))}
            onPlace={onStakePlace}
            onCashout={handleCashout}
            serverAutoBet={{
              game: "crash",
              getBetParams: () => ({
                auto_target_e6: Math.round((crashStore.get().pendingTarget ?? 2) * 1_000_000),
              }),
            }}
          />
        }
      />

      {!isDesktop && <LiveBetsFeed game="crash" limit={10} />}

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer={
          <>
            <p>진행 중 베팅이 있으면 시드 변경 불가. 라운드 종료 후 nonce 0 리셋.</p>
            <PfVerifyPageLink
              game="crash"
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
