/**
 * DiceScreen — Stake-style Dice with cinematic 3D cube, countdown timer,
 * roll animation, BetSummaryPanel, GameRulesCard, mode-aware payouts.
 *
 * Phases:
 *  betting (1.5s) → rolling (0.8s) → settled (1.4s) → betting ...
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { DiceSlider } from "@/shared/games/dice/DiceSlider";
import { Dice3D, type DicePhase } from "@/shared/games/dice/Dice3D";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { DICE_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { useMode } from "@/shared/mode/ModeContext";
import { profitOf } from "@/shared/games/engine/houseEdge";
import {
  type DiceMode,
  computeRoll,
  isWin,
  payoutMultiplier,
  winChance,
} from "@/shared/games/dice/DiceEngine";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";

const SERVER_SEED = "phonara-dice-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";
const BETTING_MS = 1500;
const ROLLING_MS = 800;
const SETTLED_MS = 1400;

interface Roll {
  id: string;
  roll: number;
  win: boolean;
}

export function DiceScreen() {
  const { mode } = useMode();
  const [phase, setPhase] = useState<DicePhase>("betting");
  const [bettingMsLeft, setBettingMsLeft] = useState(BETTING_MS);
  const [nonce, setNonce] = useState(0);
  const [target, setTarget] = useState(50);
  const [diceMode, setDiceMode] = useState<DiceMode>("over");
  const [balance, setBalance] = useState(1000);
  const [history, setHistory] = useState<Roll[]>([]);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastOutcome, setLastOutcome] = useState<
    { outcome: "win" | "loss"; profit: number; nonce: number } | null
  >(null);
  const [pendingAmount, setPendingAmount] = useState(10);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const [activeBet, setActiveBet] = useState<{ amount: number; target: number; mode: DiceMode; liveBetId: string } | null>(null);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // Betting countdown
  useEffect(() => {
    if (phase !== "betting") return;
    const startTs = performance.now();
    const id = window.setInterval(() => {
      const left = BETTING_MS - (performance.now() - startTs);
      if (left <= 0) {
        window.clearInterval(id);
        setBettingMsLeft(0);
        // if no bet was placed, simply restart betting phase
        if (!activeBet) {
          setBettingMsLeft(BETTING_MS);
        } else {
          setPhase("rolling");
        }
      } else {
        setBettingMsLeft(left);
      }
    }, 80);
    return () => window.clearInterval(id);
  }, [phase, activeBet]);

  // Rolling: compute result, advance to settled
  useEffect(() => {
    if (phase !== "rolling" || !activeBet) return;
    let alive = true;
    computeRoll({ serverSeed: SERVER_SEED, clientSeed: CLIENT_SEED, nonce }).then((roll) => {
      if (!alive) return;
      const won = isWin(roll, activeBet.target, activeBet.mode);
      const pm = payoutMultiplier(winChance(activeBet.target, activeBet.mode));
      const profit = won ? profitOf(activeBet.amount, pm, mode) : -activeBet.amount;

      // settle balance
      if (won) setBalance((b) => b + activeBet.amount + profit);

      setLastRoll(roll);
      setHistory((h) => [{ id: `n${nonce}`, roll, win: won }, ...h].slice(0, 30));
      setLastOutcome({ outcome: won ? "win" : "loss", profit, nonce });

      // push to live feed
      liveBetsStore.update(activeBet.liveBetId, {
        multiplier: won ? pm : null,
        profit: won ? +profit.toFixed(2) : -activeBet.amount,
        status: won ? "win" : "loss",
      });

      if (won) appToast.game.win({ amount: formatPHON(profit) });
      else appToast.game.lose({ amount: formatPHON(activeBet.amount) });

      // wait the rolling animation to finish, then settle
      window.setTimeout(() => {
        if (!alive) return;
        setPhase("settled");
      }, ROLLING_MS);
    });
    return () => {
      alive = false;
    };
  }, [phase, activeBet, nonce, mode]);

  // Settled → next betting phase
  useEffect(() => {
    if (phase !== "settled") return;
    const id = window.setTimeout(() => {
      setActiveBet(null);
      setNonce((n) => n + 1);
      setBettingMsLeft(BETTING_MS);
      setPhase("betting");
    }, SETTLED_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const handlePlace = useCallback(
    (amount: number) => {
      if (phase !== "betting" || activeBet || amount <= 0 || amount > balance) return;
      setBalance((b) => b - amount);
      setPendingAmount(amount);
      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "dice",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      setActiveBet({ amount, target, mode: diceMode, liveBetId });
      appToast.game.bet({ amount: formatPHON(amount) });
      // immediately advance to rolling so the round runs even if betting window is still open
      setPhase("rolling");
    },
    [phase, activeBet, balance, target, diceMode, mode],
  );

  const winPct = winChance(target, diceMode);
  const targetMult = payoutMultiplier(winPct);
  const bettingProgress = phase === "betting" ? 1 - bettingMsLeft / BETTING_MS : undefined;
  const outcome =
    phase === "settled" && lastOutcome ? (lastOutcome.outcome === "win" ? "win" : "loss") : null;

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
          <h1 className="text-xl font-extrabold leading-tight">Dice</h1>
          <ModeBadge className="mt-0.5" />
        </div>
        <span className="glass-1 ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold text-[var(--color-muted)] font-numeric">
          #{nonce.toString().padStart(4, "0")}
        </span>
        <button
          onClick={() => setShowFair(true)}
          className="glass-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
        >
          <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
          공정성
        </button>
      </header>

      {/* rules */}
      <GameRulesCard rules={DICE_RULES} onVerify={() => setShowFair(true)} />

      {/* history strip */}
      <ul className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none">
        {history.map((h) => (
          <li
            key={h.id}
            className={cn(
              "font-numeric shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-extrabold",
              h.win
                ? "bg-[color-mix(in_oklab,var(--color-emerald)_22%,transparent)] text-[var(--color-emerald)]"
                : "bg-[color-mix(in_oklab,var(--color-rose)_22%,transparent)] text-[var(--color-rose)]",
            )}
          >
            {h.roll.toFixed(2)}
          </li>
        ))}
        {history.length === 0 && (
          <li className="text-[11px] text-[var(--color-muted-2)]">아직 라운드 없음</li>
        )}
      </ul>

      {/* 3D dice */}
      <Dice3D
        phase={phase}
        rollValue={lastRoll}
        outcome={outcome}
        bettingProgress={bettingProgress}
        secondsLeft={bettingMsLeft / 1000}
      />

      {/* bet summary */}
      <BetSummaryPanel
        variant="static"
        amount={pendingAmount}
        targetMultiplier={targetMult}
        winChancePct={winPct}
      />

      {/* slider */}
      <div className="glass-2 rounded-2xl p-4">
        <DiceSlider
          target={target}
          mode={diceMode}
          onTargetChange={setTarget}
          onModeChange={setDiceMode}
          lastRoll={lastRoll}
        />
      </div>

      {/* bet panel */}
      <StakeBetPanel
        canPlace={phase === "betting" && !activeBet}
        hasActiveBet={false}
        balance={balance}
        lastOutcome={lastOutcome}
        bettingProgress={bettingProgress}
        onPlace={(amount) => {
          setPendingAmount(amount);
          handlePlace(amount);
        }}
        onCashout={() => {}}
      />

      {/* live feed (dice only) */}
      <LiveBetsFeed game="dice" limit={10} />

      {/* provably fair */}
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
              <Row k="서버 시드 (해시)">
                <code className="break-all text-[10px] text-[var(--color-cyan)]">
                  {commit || "로딩 중..."}
                </code>
              </Row>
              <Row k="클라이언트 시드">
                <code className="text-[var(--color-purple)]">{CLIENT_SEED}</code>
              </Row>
              <Row k="다음 라운드 번호">
                <code className="font-numeric">{nonce}</code>
              </Row>
              <Row k="마지막 결과">
                <code className="font-numeric text-[var(--color-gold)]">
                  {lastRoll != null ? lastRoll.toFixed(2) : "—"}
                </code>
              </Row>
            </dl>
            <p className="mt-4 text-[10px] leading-relaxed text-[var(--color-muted)]">
              결과 = floor(floatFromBytes(HMAC-SHA256(serverSeed, &quot;clientSeed:nonce:0&quot;)) × 10000) / 100
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
