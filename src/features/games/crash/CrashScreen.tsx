/**
 * CrashScreen — ROUND L-1. Crash 비주얼·공통 폴리시 (단일 슬롯, 4-phase 머신 유지).
 *
 * 불변 (0-diff)
 *  - CrashEngine.ts 0 diff (수학/상수/export)
 *  - StakeBetPanel props 계약: canPlace / hasActiveBet / bettingRoundKey / bettingProgress /
 *    suppressCashoutButton / onPlace / onCashout — 문자 그대로
 *  - useGameWallet / walletStore — refund-on-unmount, betRef 보존
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
 *  - PF apply       → activeRound.cashedAt === null 이면 refund(amount) 1회 후 store 리셋
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
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf, payoutOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import { reachedTarget } from "@/shared/games/engine/clamp";
import { type ActiveCrashRound, crashStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { cn } from "@/lib/utils";

const SERVER_SEED = "phonara-crash-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";
const HOLD_CONFIRM_MS = 150;

type Phase = "betting" | "running" | "crashed" | "cooldown";

interface ActiveBet {
  amount: number;
  autoTarget: number;
  cashedAt: number | null;
  liveBetId: string;
}

export function CrashScreen() {
  useRegisterMainMode("game");
  const { mode, balance, tryDebit, credit, refund } = useGameWallet();

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

  // Refund unsettled bet on unmount (user left mid-round) — 보존
  const refundRef = useRef(refund);
  refundRef.current = refund;
  useEffect(() => {
    return () => {
      const b = betRef.current;
      if (b && b.cashedAt === null) refundRef.current(b.amount);
    };
  }, []);

  // ─── 마운트 복원 (1회) ────────────────────────────────────────────
  // activeRound != null && 미settle → bet/phase/crashPoint/startedAt hydrate만.
  // tryDebit / liveBetsStore.push 0회.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const ar = crashStore.get().activeRound;
    if (!ar || ar.cashedAt !== null) return;
    setBet({
      amount: ar.amount,
      autoTarget: ar.autoTarget,
      cashedAt: ar.cashedAt,
      liveBetId: ar.liveBetId,
    });
    setCrashPoint(ar.crashPoint);
    bettingStartedAtRef.current = ar.bettingStartedAt || performance.now();
    if (ar.startedAt > 0) {
      // running 복원
      startedAtRef.current = ar.startedAt;
      setStartedAt(ar.startedAt);
      setBettingMsLeft(0);
      setPhase("running");
    } else if (ar.bettingStartedAt > 0) {
      // betting 복원 — 잔여 시간 재계산
      const left = BETTING_MS - (performance.now() - ar.bettingStartedAt);
      if (left <= 0) {
        const t = performance.now();
        startedAtRef.current = t;
        setStartedAt(t);
        crashStore.set((s) =>
          s.activeRound ? { ...s, activeRound: { ...s.activeRound, startedAt: t } } : s,
        );
        setBettingMsLeft(0);
        setPhase("running");
      } else {
        setBettingMsLeft(left);
        setPhase("betting");
      }
    }
  }, []);

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
          setBet({ ...prev, cashedAt: prev.autoTarget });
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
  }, [phase, crashPoint, sfx]);

  // ─── crashed → settle once (deps에 bet 금지) ──────────────────────
  useEffect(() => {
    if (phase !== "crashed") return;
    if (settledRef.current) return;
    settledRef.current = true;

    const activeBet = betRef.current;
    const roundId = `n${nonce}`;
    if (activeBet) {
      const cashed = activeBet.cashedAt;
      if (cashed !== null) {
        const profit = profitOf(activeBet.amount, cashed, mode);
        const payout = Math.round(payoutOf(activeBet.amount, cashed, mode));
        void credit(payout, cashed, { game: "crash", roundId });
        crashStore.set((s) => ({
          ...s,
          lastOutcome: { outcome: "win", profit, nonce },
          activeRound: null,
        }));
        recordSessionOutcome({ outcome: "win", profit, multiplier: cashed });
        sfx.play("cashout");
        liveBetsStore.update(activeBet.liveBetId, {
          multiplier: cashed,
          profit: +profit.toFixed(2),
          status: "cashout",
        });
      } else {
        crashStore.set((s) => ({
          ...s,
          lastOutcome: { outcome: "loss", profit: -activeBet.amount, nonce },
          activeRound: null,
        }));
        recordSessionOutcome({ outcome: "loss", profit: -activeBet.amount });
        sfx.play("loss");
        setFlashKey((k) => k + 1);
        liveBetsStore.update(activeBet.liveBetId, {
          multiplier: null,
          profit: -activeBet.amount,
          status: "bust",
        });
      }
    } else {
      // 베팅 없이 BUST — activeRound도 null (no-op safety)
      crashStore.set((s) => (s.activeRound ? { ...s, activeRound: null } : s));
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
      };
      crashStore.set((s) => ({
        ...s,
        pendingAmount: amount,
        pendingTarget: autoTarget,
        activeRound: ar,
      }));
      setBet({ amount, autoTarget, cashedAt: null, liveBetId });
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
    crashStore.set((s) =>
      s.activeRound ? { ...s, activeRound: { ...s.activeRound, cashedAt: m } } : s,
    );
    setBet((prev) => (prev ? { ...prev, cashedAt: m } : prev));
  }, [phase, startedAt]);

  const getCurrentMultiplier = useCallback(() => {
    if (phase !== "running") return bet?.cashedAt ?? 1.0;
    return multiplierAt(performance.now() - startedAtRef.current);
  }, [phase, bet?.cashedAt]);

  // ─── PF seed 적용 — 미정산 베팅 refund 1회 ───────────────────────
  const applySeed = useCallback(() => {
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    const cur = crashStore.get().clientSeed;
    if (next === cur) {
      setShowFair(false);
      return;
    }
    const ar = crashStore.get().activeRound;
    if (ar && ar.cashedAt === null) {
      // place 시 즉시 debit이라 seed reset만 하면 돈이 샘 → refund 1회.
      refundRef.current(ar.amount);
      liveBetsStore.update(ar.liveBetId, {
        multiplier: null,
        profit: 0,
        status: "bust",
      });
    }
    crashStore.set((s) => ({
      ...s,
      clientSeed: next,
      nonce: 0,
      activeRound: null,
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
    appToast.game.bet({ amount: "시드 변경됨 · nonce 0 리셋" });
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
              holdConfirmMs={HOLD_CONFIRM_MS}
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
        footer="시드 변경 시 nonce 0 리셋 + 진행 중 라운드 환불(refund). 동일 시드/라운드는 항상 같은 결과를 만듭니다."
      />
    </div>
  );
}
