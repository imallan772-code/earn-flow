/**
 * DiceScreen — Stake/Roobet-style: no timer, instant roll, persisted state.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import { DiceSlider } from "@/shared/games/dice/DiceSlider";
import { DiceResultDisplay, type DicePhase } from "@/shared/games/dice/DiceResultDisplay";
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { DICE_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import {
  type DiceMode,
  computeRoll,
  isWin,
  payoutMultiplier,
  winChance,
} from "@/shared/games/dice/DiceEngine";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import { diceStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { cn } from "@/lib/utils";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";

const SERVER_SEED = "phonara-dice-demo-server-seed-v1";
const CLIENT_SEED = "phonara-player-001";
const ROLLING_MS = 800;
const SETTLED_MS = 800;

export function DiceScreen() {
  useRegisterMainMode("game");
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const [phase, setPhase] = useState<DicePhase>("idle");

  // Persisted state
  const nonce = diceStore.use((s) => s.nonce);
  const history = diceStore.use((s) => s.history);
  const lastRoll = diceStore.use((s) => s.lastRoll);
  const lastOutcome = diceStore.use((s) => s.lastOutcome);
  const target = diceStore.use((s) => s.target);
  const diceMode = diceStore.use((s) => s.diceMode);
  const pendingAmount = diceStore.use((s) => s.pendingAmount);

  const [activeBet, setActiveBet] = useState<{
    amount: number;
    target: number;
    mode: DiceMode;
    liveBetId: string;
    nonce: number;
  } | null>(null);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);

  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // Rolling → compute & settle
  useEffect(() => {
    if (phase !== "rolling" || !activeBet) return;
    let alive = true;
    computeRoll({ serverSeed: SERVER_SEED, clientSeed: CLIENT_SEED, nonce: activeBet.nonce }).then(
      (roll) => {
        if (!alive) return;
        const won = isWin(roll, activeBet.target, activeBet.mode);
        const pm = payoutMultiplier(winChance(activeBet.target, activeBet.mode));
        const profit = won ? profitOf(activeBet.amount, pm, mode) : -activeBet.amount;

        if (won) {
          // gross payout = stake + profit (stake was already debited at place)
          void credit(activeBet.amount + profit, pm, {
            game: "dice",
            roundId: `n${activeBet.nonce}`,
          });
        }
        diceStore.set((s) => ({
          ...s,
          lastRoll: roll,
          history: [{ id: `n${activeBet.nonce}`, roll, win: won }, ...s.history].slice(0, 30),
          lastOutcome: { outcome: won ? "win" : "loss", profit, nonce: activeBet.nonce, roll },
        }));

        liveBetsStore.update(activeBet.liveBetId, {
          multiplier: won ? pm : null,
          profit: won ? +profit.toFixed(2) : -activeBet.amount,
          status: won ? "win" : "loss",
        });

        if (won) appToast.game.win({ amount: formatPHON(profit) });
        else appToast.game.lose({ amount: formatPHON(activeBet.amount) });

        window.setTimeout(() => {
          if (!alive) return;
          setPhase("settled");
        }, ROLLING_MS);
      },
    );
    return () => {
      alive = false;
    };
  }, [phase, activeBet, mode, credit]);

  // Settled → idle (ready for next bet)
  useEffect(() => {
    if (phase !== "settled") return;
    const id = window.setTimeout(() => {
      setActiveBet(null);
      diceStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
      setPhase("idle");
    }, SETTLED_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (phase !== "idle" || activeBet || amount <= 0) return;
      const ok = await tryDebit(amount, { game: "dice", roundId: `n${nonce}` });
      if (!ok) return;
      diceStore.set((s) => ({ ...s, pendingAmount: amount }));
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
      setActiveBet({ amount, target, mode: diceMode, liveBetId, nonce });
      appToast.game.bet({ amount: formatPHON(amount) });
      setPhase("rolling");
    },
    [phase, activeBet, target, diceMode, mode, nonce, tryDebit],
  );

  const setTarget = useCallback((t: number) => diceStore.set((s) => ({ ...s, target: t })), []);
  const setDiceMode = useCallback(
    (m: DiceMode) => diceStore.set((s) => ({ ...s, diceMode: m })),
    [],
  );

  const winPct = winChance(target, diceMode);
  const targetMult = payoutMultiplier(winPct);
  const outcome = phase === "settled" && lastOutcome ? lastOutcome.outcome : null;

  return (
    <div className="flex flex-col gap-2">
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

      <GameRulesCard rules={DICE_RULES} onVerify={() => setShowFair(true)} />

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
            {h.roll.toFixed(2)}
          </li>
        ))}
        {history.length === 0 && <li className="type-caption">아직 라운드 없음</li>}
      </ul>

      <DiceResultDisplay
        phase={phase}
        rollValue={lastRoll}
        outcome={outcome}
        target={target}
        diceMode={diceMode}
        payoutMultiplier={targetMult}
        winChancePct={winPct}
      />

      <div className="glass-2 rounded-2xl p-3">
        <DiceSlider
          target={target}
          mode={diceMode}
          onTargetChange={setTarget}
          onModeChange={setDiceMode}
          lastRoll={lastRoll}
        />
      </div>

      <BetSummaryPanel
        variant="static"
        amount={pendingAmount}
        targetMultiplier={targetMult}
        winChancePct={winPct}
      />

      <DemoLowBanner />

      <StakeBetPanel
        canPlace={phase === "idle" && !activeBet}
        hasActiveBet={false}
        balance={balance}
        lastOutcome={lastOutcome}
        showAutoTarget={false}
        onPlace={(amount) => {
          diceStore.set((s) => ({ ...s, pendingAmount: amount }));
          handlePlace(amount);
        }}
        onCashout={() => {}}
      />

      <LiveBetsFeed game="dice" limit={10} />

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
              <Row k="마지막 결과">
                <code className="font-numeric text-gold">
                  {lastRoll != null ? lastRoll.toFixed(2) : "—"}
                </code>
              </Row>
            </dl>
            <p className="mt-4 type-caption leading-relaxed">
              결과 = floor(floatFromBytes(HMAC-SHA256(serverSeed, &quot;clientSeed:nonce:0&quot;)) ×
              10000) / 100
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
