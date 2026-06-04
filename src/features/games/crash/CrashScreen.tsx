/**
 * CrashScreen — orchestrates rounds: betting → running → crashed → cooldown.
 *
 * Uses Round-A engine for crashpoint, multiplier curve, and auto-cashout.
 * Single RAF via sharedTickLoop in the canvas.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { CrashCanvas } from "@/shared/games/crash/CrashCanvas";
import {
  BETTING_MS,
  COOLDOWN_MS,
  computeCrashPoint,
  multiplierAt6,
} from "@/shared/games/crash/CrashEngine";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { CRASH_HISTORY, LIVE_BETS_SEED } from "@/mocks/crashHistory";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import { reachedTarget } from "@/shared/games/engine/clamp";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";

const SERVER_SEED = "phonara-crash-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";

type Phase = "betting" | "running" | "crashed" | "cooldown";

interface ActiveBet {
  amount: number;
  autoTarget: number;
  cashedAt: number | null;
}

export function CrashScreen() {
  const [phase, setPhase] = useState<Phase>("betting");
  const [nonce, setNonce] = useState(0);
  const [crashPoint, setCrashPoint] = useState(1.0);
  const [startedAt, setStartedAt] = useState(0);
  const [bettingMsLeft, setBettingMsLeft] = useState(BETTING_MS);
  const [, force] = useState(0);
  const tickHandle = useRef<number | null>(null);

  const [balance, setBalance] = useState(1000);
  const [bet, setBet] = useState<ActiveBet | null>(null);
  const [lastOutcome, setLastOutcome] = useState<
    { outcome: "win" | "loss"; profit: number; nonce: number } | null
  >(null);

  const [history, setHistory] = useState(CRASH_HISTORY);
  const [showFair, setShowFair] = useState(false);
  const [commit, setCommit] = useState("");

  // commit hash on mount
  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // Initialize each round: compute crashPoint, start betting countdown.
  useEffect(() => {
    if (phase !== "betting") return;
    let alive = true;
    computeCrashPoint({
      serverSeed: SERVER_SEED,
      clientSeed: CLIENT_SEED,
      nonce,
    }).then((cp) => {
      if (!alive) return;
      setCrashPoint(cp);
    });

    const startTs = performance.now();
    const id = window.setInterval(() => {
      const left = BETTING_MS - (performance.now() - startTs);
      if (left <= 0) {
        window.clearInterval(id);
        setBettingMsLeft(0);
        setStartedAt(performance.now());
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

  // Running phase: poll multiplier for auto-cashout + bust detection.
  useEffect(() => {
    if (phase !== "running") return;
    const id = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const m = multiplierAt6(elapsed);

      // auto cashout
      if (bet && bet.cashedAt === null && reachedTarget(m, bet.autoTarget) && bet.autoTarget < crashPoint) {
        setBet({ ...bet, cashedAt: bet.autoTarget });
      }

      // bust
      if (m >= crashPoint) {
        setPhase("crashed");
      }
      force((x) => x + 1);
    }, 50);
    return () => window.clearInterval(id);
  }, [phase, startedAt, crashPoint, bet]);

  // Crashed → settle bet → cooldown → next round.
  useEffect(() => {
    if (phase !== "crashed") return;
    if (bet) {
      const cashed = bet.cashedAt;
      if (cashed !== null) {
        const profit = bet.amount * (cashed - 1);
        setBalance((b) => b + bet.amount * cashed);
        setLastOutcome({ outcome: "win", profit, nonce });
        appToast.game.cashout({ mult: cashed.toFixed(2), amount: formatPHON(profit) });
      } else {
        setLastOutcome({ outcome: "loss", profit: -bet.amount, nonce });
        appToast.game.bust({ amount: formatPHON(bet.amount) });
      }
    }
    setHistory((h) => [{ id: `n${nonce}`, multiplier: crashPoint }, ...h].slice(0, 30));
    setBet(null);

    const t = window.setTimeout(() => {
      setPhase("cooldown");
      window.setTimeout(() => {
        setNonce((n) => n + 1);
        setBettingMsLeft(BETTING_MS);
        setPhase("betting");
      }, COOLDOWN_MS - 1200);
    }, 1200);
    return () => window.clearTimeout(t);
  }, [phase, bet, crashPoint, nonce]);

  const handlePlace = useCallback(
    (amount: number, autoTarget: number) => {
      if (phase !== "betting" || bet || amount <= 0 || amount > balance) return;
      setBalance((b) => b - amount);
      setBet({ amount, autoTarget, cashedAt: null });
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [phase, bet, balance],
  );

  const handleCashout = useCallback(() => {
    if (phase !== "running" || !bet || bet.cashedAt !== null) return;
    const m = multiplierAt6(performance.now() - startedAt);
    setBet({ ...bet, cashedAt: m });
  }, [phase, bet, startedAt]);

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
        <div>
          <h1 className="text-xl font-extrabold">Crash</h1>
          <p className="text-[11px] text-[var(--color-muted)]">99% RTP · Provably Fair</p>
        </div>
        <button
          onClick={() => setShowFair(true)}
          className="glass-1 ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
        >
          <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
          공정성
        </button>
      </header>

      {/* history strip */}
      <ul className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
        {history.map((h) => (
          <li
            key={h.id}
            className={cn(
              "font-numeric shrink-0 rounded-full px-2 py-1 text-[11px] font-bold",
              h.multiplier < 2
                ? "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)] text-[var(--color-rose)]"
                : h.multiplier < 10
                  ? "bg-[color-mix(in_oklab,var(--color-warning)_22%,transparent)] text-[var(--color-warning)]"
                  : "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] text-[var(--color-emerald)]",
            )}
          >
            {h.multiplier.toFixed(2)}x
          </li>
        ))}
      </ul>

      {/* canvas */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl">
        <CrashCanvas
          phase={phase}
          startedAt={startedAt}
          crashPoint={crashPoint}
          bettingMsLeft={bettingMsLeft}
        />
        {bet && (
          <div className="glass-2 absolute left-3 top-3 rounded-xl px-3 py-1.5 text-[11px]">
            <span className="text-[var(--color-muted)]">내 베팅 </span>
            <span className="font-numeric font-bold">{bet.amount.toFixed(2)}</span>
            {bet.cashedAt !== null && (
              <span className="font-numeric ml-2 text-[var(--color-emerald)]">
                ✓ {bet.cashedAt.toFixed(2)}x
              </span>
            )}
          </div>
        )}
      </div>

      {/* bet panel */}
      <StakeBetPanel
        canPlace={phase === "betting"}
        hasActiveBet={!!bet && bet.cashedAt === null && phase === "running"}
        balance={balance}
        lastOutcome={lastOutcome}
        onPlace={handlePlace}
        onCashout={handleCashout}
      />

      {/* live bets */}
      <section className="glass-1 rounded-2xl p-3">
        <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--color-muted)]">
          라이브 베팅
        </h3>
        <ul className="flex flex-col divide-y divide-[var(--color-border)]">
          {LIVE_BETS_SEED.map((b) => (
            <li key={b.id} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-[var(--color-muted)]">{b.user}</span>
              <span className="font-numeric">{b.bet.toFixed(2)}</span>
              <span
                className={cn(
                  "font-numeric w-16 text-right",
                  b.cashout === null ? "text-[var(--color-muted-2)]" : "text-[var(--color-emerald)]",
                )}
              >
                {b.cashout === null ? "—" : `${b.cashout.toFixed(2)}x`}
              </span>
              <span className="font-numeric w-20 text-right">
                {b.payout === null ? "—" : b.payout.toFixed(2)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* provably fair sheet */}
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
              <Row k="다음 Server Seed (Hash)">
                <code className="break-all text-[10px] text-[var(--color-cyan)]">
                  {commit || "loading..."}
                </code>
              </Row>
              <Row k="Client Seed">
                <code className="text-[var(--color-purple)]">{CLIENT_SEED}</code>
              </Row>
              <Row k="다음 Nonce">
                <code className="font-numeric">{nonce}</code>
              </Row>
              <Row k="현재 라운드 결과">
                <code className="font-numeric text-[var(--color-gold)]">
                  {phase === "crashed" || phase === "cooldown" ? `${crashPoint.toFixed(2)}x` : "진행중"}
                </code>
              </Row>
            </dl>
            <p className="mt-4 text-[10px] leading-relaxed text-[var(--color-muted)]">
              라운드 종료 후 Server Seed가 공개되면 위 Hash를 직접 SHA-256으로 검증할 수 있습니다.
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
      <dt className="shrink-0 text-[var(--color-muted)]">{k}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}
