/**
 * CrashScreen — persisted balance/history/lastOutcome via crashStore.
 * Cashout button unified to the BetSummaryPanel (top); StakeBetPanel
 * shows a disabled placeholder during active rounds.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { CrashCanvas } from "@/shared/games/crash/CrashCanvas";
import {
  BETTING_MS,
  COOLDOWN_MS,
  computeCrashPoint,
  multiplierAt,
  multiplierAt6,
} from "@/shared/games/crash/CrashEngine";
import { sharedTickLoop } from "@/shared/games/engine/tickLoop";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { CRASH_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf, payoutOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import { reachedTarget } from "@/shared/games/engine/clamp";
import { crashStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";

const SERVER_SEED = "phonara-crash-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";

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

  // Persisted
  const nonce = crashStore.use((s) => s.nonce);
  const history = crashStore.use((s) => s.history);
  const lastOutcome = crashStore.use((s) => s.lastOutcome);
  const pendingAmount = crashStore.use((s) => s.pendingAmount);
  const pendingTarget = crashStore.use((s) => s.pendingTarget);

  const [phase, setPhase] = useState<Phase>("betting");
  const [crashPoint, setCrashPoint] = useState(1.0);
  const [startedAt, setStartedAt] = useState(0);
  const [bettingMsLeft, setBettingMsLeft] = useState(BETTING_MS);
  const tickHandle = useRef<number | null>(null);
  const [bet, setBet] = useState<ActiveBet | null>(null);
  const [showFair, setShowFair] = useState(false);
  const [commit, setCommit] = useState("");
  const [flashKey, setFlashKey] = useState(0);
  const startedAtRef = useRef(0);
  const betRef = useRef<ActiveBet | null>(null);
  betRef.current = bet;
  const settledRef = useRef(false);
  const roundTimerRef = useRef<number | null>(null);

  // commit hash
  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // Refund unsettled bet on unmount (user left mid-round)
  const refundRef = useRef(refund);
  refundRef.current = refund;
  useEffect(() => {
    return () => {
      const b = betRef.current;
      if (b && b.cashedAt === null) {
        refundRef.current(b.amount);
      }
    };
  }, []);

  // Round init
  useEffect(() => {
    if (phase !== "betting") return;
    let alive = true;
    computeCrashPoint({ serverSeed: SERVER_SEED, clientSeed: CLIENT_SEED, nonce }).then((cp) => {
      if (!alive) return;
      setCrashPoint(cp);
    });

    const startTs = performance.now();
    const id = window.setInterval(() => {
      const left = BETTING_MS - (performance.now() - startTs);
      if (left <= 0) {
        window.clearInterval(id);
        setBettingMsLeft(0);
        const t = performance.now();
        startedAtRef.current = t;
        setStartedAt(t);
        setPhase("running");
      } else {
        setBettingMsLeft(left);
      }
    }, 100);
    tickHandle.current = id;
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, [phase, nonce]);

  // Running — logic on shared RAF (CrashCanvas already redraws each frame)
  useEffect(() => {
    if (phase !== "running") return;
    const loop = sharedTickLoop();
    const unsub = loop.subscribe(() => {
      const elapsed = performance.now() - startedAtRef.current;
      const m = multiplierAt6(elapsed);
      setBet((prev) => {
        if (!prev || prev.cashedAt !== null) return prev;
        if (reachedTarget(m, prev.autoTarget) && prev.autoTarget < crashPoint) {
          return { ...prev, cashedAt: prev.autoTarget };
        }
        return prev;
      });
      if (m >= crashPoint) setPhase("crashed");
    });
    return () => unsub();
  }, [phase, crashPoint]);

  // Crashed → settle once per round (do NOT list `bet` in deps — setBet(null) would cancel timers)
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
        }));
        appToast.game.cashout({ mult: cashed.toFixed(2), amount: formatPHON(profit) });
        liveBetsStore.update(activeBet.liveBetId, {
          multiplier: cashed,
          profit: +profit.toFixed(2),
          status: "cashout",
        });
      } else {
        crashStore.set((s) => ({
          ...s,
          lastOutcome: { outcome: "loss", profit: -activeBet.amount, nonce },
        }));
        appToast.game.bust({ amount: formatPHON(activeBet.amount) });
        setFlashKey((k) => k + 1);
        liveBetsStore.update(activeBet.liveBetId, {
          multiplier: null,
          profit: -activeBet.amount,
          status: "bust",
        });
      }
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
        crashStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
        setBettingMsLeft(BETTING_MS);
        setPhase("betting");
      }, COOLDOWN_MS - 1200);
    }, 1200);

    return () => {
      if (roundTimerRef.current != null) window.clearTimeout(roundTimerRef.current);
      roundTimerRef.current = null;
    };
  }, [phase, crashPoint, nonce, mode, credit]);

  const handlePlace = useCallback(
    async (amount: number, autoTarget: number): Promise<boolean> => {
      if (phase !== "betting" || bet || amount <= 0) return false;
      const ok = await tryDebit(amount, { game: "crash", roundId: `n${nonce}` });
      if (!ok) return false;
      crashStore.set((s) => ({
        ...s,
        pendingAmount: amount,
        pendingTarget: autoTarget,
      }));
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
      setBet({ amount, autoTarget, cashedAt: null, liveBetId });
      appToast.game.bet({ amount: formatPHON(amount) });
      return true;
    },
    [phase, bet, mode, tryDebit, nonce],
  );

  const onStakePlace = useCallback(
    (amount: number, autoTarget: number) => {
      crashStore.set((s) => ({
        ...s,
        pendingAmount: amount,
        pendingTarget: autoTarget,
      }));
      return handlePlace(amount, autoTarget);
    },
    [handlePlace],
  );

  const handleCashout = useCallback(() => {
    if (phase !== "running" || !bet || bet.cashedAt !== null) return;
    const m = multiplierAt6(performance.now() - startedAt);
    setBet({ ...bet, cashedAt: m });
  }, [phase, bet, startedAt]);

  const getCurrentMultiplier = useCallback(() => {
    if (phase !== "running") return bet?.cashedAt ?? 1.0;
    return multiplierAt(performance.now() - startedAtRef.current);
  }, [phase, bet?.cashedAt]);

  const bettingProgress = phase === "betting" ? 1 - bettingMsLeft / BETTING_MS : undefined;

  const displayHistory = useMemo(() => {
    const seen = new Set<string>();
    return history.filter((h) => {
      if (seen.has(h.id)) return false;
      seen.add(h.id);
      return true;
    });
  }, [history]);

  return (
    <div className="flex flex-col gap-3">
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

      <GameRulesCard rules={CRASH_RULES} onVerify={() => setShowFair(true)} />

      <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        {displayHistory.map((h) => (
          <li
            key={h.id}
            className={cn(
              "font-numeric shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold",
              h.multiplier < 2
                ? "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)] text-(--color-rose)"
                : h.multiplier < 10
                  ? "bg-[color-mix(in_oklab,var(--color-warning)_22%,transparent)] text-warning"
                  : "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] text-emerald",
            )}
          >
            {h.multiplier.toFixed(2)}x
          </li>
        ))}
      </ul>

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
        {phase === "crashed" && (
          <div
            key={flashKey}
            className="animate-crash-flash pointer-events-none absolute inset-0 bg-(--color-rose)"
            aria-hidden
          />
        )}
      </div>

      {bet ? (
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
        <BetSummaryPanel variant="static" amount={pendingAmount} targetMultiplier={pendingTarget} />
      )}

      <DemoLowBanner />

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

      <LiveBetsFeed game="crash" limit={10} />

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
              <button onClick={() => setShowFair(false)}>
                <X size={18} />
              </button>
            </div>
            <dl className="flex flex-col gap-3 text-xs">
              <Row k="다음 서버 시드 (해시)">
                <code className="break-all text-[10px] text-(--color-cyan)">
                  {commit || "로딩 중..."}
                </code>
              </Row>
              <Row k="클라이언트 시드">
                <code className="text-(--color-purple)">{CLIENT_SEED}</code>
              </Row>
              <Row k="다음 라운드 번호">
                <code className="font-numeric">{nonce}</code>
              </Row>
              <Row k="현재 라운드 결과">
                <code className="font-numeric text-gold">
                  {phase === "crashed" || phase === "cooldown"
                    ? `${crashPoint.toFixed(2)}x`
                    : "진행 중"}
                </code>
              </Row>
            </dl>
            <p className="mt-4 type-caption leading-relaxed">
              라운드 종료 후 서버 시드가 공개되면 위 해시를 직접 SHA-256으로 검증할 수 있습니다.
              모든 라운드는 HMAC-SHA256(serverSeed, &quot;clientSeed:nonce:0&quot;)으로 결정됩니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-(--color-muted)">{k}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
