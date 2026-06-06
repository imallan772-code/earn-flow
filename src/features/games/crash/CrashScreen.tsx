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
 * TODO(real-money): crash round settle via Edge Function + debit_phon_for_bet_v2 (Cursor)
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CrashCanvas } from "@/shared/games/crash/CrashCanvas";
import { CrashMultiplierBadge } from "./CrashMultiplierBadge";
import {
  BETTING_MS,
  COOLDOWN_MS,
  computeCrashPoint,
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
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { CRASH_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf, payoutOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import { reachedTarget } from "@/shared/games/engine/clamp";
import { type ActiveCrashRound, crashStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { PF_BLOCK_ACTIVE_ROUND_MSG } from "@/shared/games/ui/pfPolicy";
import {
  clearRealSession,
  fetchRealSession,
  nonceFromRoundId,
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

const SERVER_SEED = "phonara-crash-demo-server-seed-v1";
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
  if (!ar || ar.betMode !== "real") return;
  syncRealSession("crash", `n${ar.nonce}`, ar.amount, {
    nonce: ar.nonce,
    auto_target: ar.autoTarget,
    cashed_at: ar.cashedAt,
    live_bet_id: ar.liveBetId,
    crash_point: ar.crashPoint,
    started_at: ar.startedAt,
    betting_started_at: ar.bettingStartedAt,
    placed_at: ar.placedAt,
  });
}

export function CrashScreen() {
  useRegisterMainMode("game");
  const { mode, balance, tryDebit, credit } = useGameWallet();

  // Persisted store reads
  const nonce = crashStore.use((s) => s.nonce);
  const history = crashStore.use((s) => s.history);
  const lastOutcome = crashStore.use((s) => s.lastOutcome);
  const pendingAmount = crashStore.use((s) => s.pendingAmount);
  const pendingTarget = crashStore.use((s) => s.pendingTarget);

  // Local phase / round state
  const [phase, setPhase] = useState<Phase>("betting");
  const [crashPoint, setCrashPoint] = useState(1.0);
  const [startedAt, setStartedAt] = useState(0);
  const [bettingMsLeft, setBettingMsLeft] = useState(BETTING_MS);
  const [bet, setBet] = useState<ActiveBet | null>(null);
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const [commit, setCommit] = useState("");
  const [flashKey, setFlashKey] = useState(0);

  // Refs
  const startedAtRef = useRef(0);
  const bettingStartedAtRef = useRef(0);
  const betRef = useRef<ActiveBet | null>(null);
  betRef.current = bet;
  const settledRef = useRef(false);
  const roundTimerRef = useRef<number | null>(null);
  const restoredRef = useRef(false);
  const tickIntervalRef = useRef<number | null>(null);
  const sfx = useSfx();

  // PF commit hash
  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

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
      setCrashPoint(ar.crashPoint);
      bettingStartedAtRef.current = ar.bettingStartedAt || performance.now();
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

  // activeRound persists on navigation — resume on remount (Stake-like; no unmount refund).
  // real: server SSOT first; demo: localStorage.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const applyLocal = () => {
      const ar = crashStore.get().activeRound;
      if (ar) hydrateCrashActiveRound(ar);
    };

    if (mode !== "real") {
      applyLocal();
      return;
    }

    void fetchRealSession("crash").then((row) => {
      if (row) {
        const cs = row.client_state as {
          nonce?: number;
          auto_target?: number;
          cashed_at?: number | null;
          live_bet_id?: string;
          crash_point?: number;
          started_at?: number;
          betting_started_at?: number;
          placed_at?: number;
        };
        const local = crashStore.get().activeRound;
        const ar: ActiveCrashRound = {
          nonce: cs.nonce ?? nonceFromRoundId(row.round_id),
          amount: row.bet_amount,
          autoTarget: cs.auto_target ?? crashStore.get().pendingTarget,
          cashedAt: cs.cashed_at ?? null,
          liveBetId: local?.liveBetId ?? cs.live_bet_id ?? `lb_crash_${row.round_id}`,
          placedAt: cs.placed_at ?? Date.now(),
          crashPoint: cs.crash_point ?? 2,
          startedAt: cs.started_at ?? 0,
          bettingStartedAt: cs.betting_started_at ?? performance.now(),
          betMode: "real",
        };
        crashStore.set((s) => ({ ...s, activeRound: ar }));
        hydrateCrashActiveRound(ar);
        return;
      }
      applyLocal();
    });
  }, [mode, hydrateCrashActiveRound]);

  // ─── betting phase 머신 ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== "betting") return;
    let alive = true;
    // PF 시드 적용 후에도 항상 최신 시드 사용
    void computeCrashPoint({
      serverSeed: SERVER_SEED,
      clientSeed: crashStore.get().clientSeed || DEFAULT_CLIENT_SEED,
      nonce,
    }).then((cp) => {
      if (!alive) return;
      setCrashPoint(cp);
      // 복원이 아닌 fresh betting 진입 시 → bettingStartedAt 새로 스냅샷
      // (복원 분기에서 이미 ref가 채워져 있으면 그대로 두고 첫 진입 시 적용)
      if (bettingStartedAtRef.current === 0 || !crashStore.get().activeRound) {
        bettingStartedAtRef.current = performance.now();
      }
    });

    // betting 카운트다운
    const startTs =
      bettingStartedAtRef.current > 0 ? bettingStartedAtRef.current : performance.now();
    if (bettingStartedAtRef.current === 0) bettingStartedAtRef.current = startTs;

    const id = window.setInterval(() => {
      const left = BETTING_MS - (performance.now() - bettingStartedAtRef.current);
      if (left <= 0) {
        window.clearInterval(id);
        setBettingMsLeft(0);
        const t = performance.now();
        startedAtRef.current = t;
        setStartedAt(t);
        // activeRound에 startedAt 스냅샷 (베팅 있었던 경우만)
        crashStore.set((s) =>
          s.activeRound ? { ...s, activeRound: { ...s.activeRound, startedAt: t } } : s,
        );
        syncCrashSessionFromStore();
        setPhase("running");
      } else {
        setBettingMsLeft(left);
      }
    }, 100);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [phase, nonce]);

  // ─── running phase 머신 (sharedTickLoop) ──────────────────────────
  useEffect(() => {
    if (phase !== "running") return;
    const loop = sharedTickLoop();
    // tick SFX every 200ms
    if (tickIntervalRef.current == null) {
      tickIntervalRef.current = window.setInterval(() => sfx.play("tick"), 200);
    }
    const unsub = loop.subscribe(() => {
      const elapsed = performance.now() - startedAtRef.current;
      const m = multiplierAt6(elapsed);
      const prev = betRef.current;
      if (prev && prev.cashedAt === null) {
        if (reachedTarget(m, prev.autoTarget) && prev.autoTarget < crashPoint) {
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
      if (m >= crashPoint) setPhase("crashed");
    });
    return () => {
      unsub();
      if (tickIntervalRef.current != null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [phase, crashPoint, sfx, mode]);

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
        void credit(payout, cashed, { game: "crash", roundId });
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
    if (betMode === "real" && amount != null) {
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
      if (phase !== "betting" || betRef.current || amount <= 0) return false;
      const ok = await tryDebit(amount, { game: "crash", roundId: `n${nonce}` });
      if (!ok) return false;
      const liveBetId = liveBetsStore.push({
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
        crashPoint,
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
      syncCrashSessionFromStore();
      sfx.play("bet");
      return true;
    },
    [phase, mode, tryDebit, nonce, crashPoint, sfx],
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
    const m = multiplierAt6(performance.now() - startedAt);
    const prev = betRef.current;
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
  }, [phase, startedAt, mode]);

  const getCurrentMultiplier = useCallback(() => {
    if (phase !== "running") return bet?.cashedAt ?? 1.0;
    return multiplierAt(performance.now() - startedAtRef.current);
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
  }, [seedDraft]);

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
        <code className="break-all text-[10px] text-(--color-cyan)">{commit || "로딩 중..."}</code>
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
    { label: "다음 라운드 번호", content: <code className="font-numeric">{nonce}</code> },
    {
      label: "현재 라운드 결과",
      content: (
        <code className="font-numeric text-gold">
          {phase === "crashed" || phase === "cooldown" ? `${crashPoint.toFixed(2)}x` : "진행 중"}
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
            canPlace={phase === "betting"}
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
          />
        }
      />

      <LiveBetsFeed game="crash" limit={10} />

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer="진행 중 베팅이 있으면 시드 변경 불가. 라운드 종료 후 nonce 0 리셋."
      />
    </div>
  );
}
