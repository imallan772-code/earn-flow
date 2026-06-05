/**
 * DiceScreen — ROUND K. Wheel(ROUND J) SSOT 정렬.
 *
 * 불변
 *  - DiceEngine.ts 0 diff
 *  - StakeBetPanel props/onPlace/lastOutcome 계약 0 diff
 *  - diceStore version=2 / localStorage key 불변
 *
 * nonce 정책 (Wheel과 다름 — 현행 유지)
 *  - place 시점에 store.nonce 스냅샷만 사용. **idle 복귀 시 nonce++.**
 *
 * 토스트 정책
 *  - 일반 bet/win/loss toast 제거 (Wheel/Limbo 정렬). 시드 변경 토스트만 유지.
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
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
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
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";

const SERVER_SEED = "phonara-dice-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";
const ROLLING_MS = 800;
const SETTLED_MS = 800;

export function DiceScreen() {
  useRegisterMainMode("game");
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = diceStore.use((s) => s.nonce);
  const history = diceStore.use((s) => s.history);
  const lastRoll = diceStore.use((s) => s.lastRoll);
  const lastOutcome = diceStore.use((s) => s.lastOutcome);
  const target = diceStore.use((s) => s.target);
  const diceMode = diceStore.use((s) => s.diceMode);
  const pendingAmount = diceStore.use((s) => s.pendingAmount);

  const round = useGameRound({ rollingMs: ROLLING_MS, settledMs: SETTLED_MS });
  const [activeBet, setActiveBet] = useState<{
    amount: number;
    target: number;
    mode: DiceMode;
    liveBetId: string;
    nonce: number;
  } | null>(null);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const sfx = useSfx();
  const tickIntervalRef = useRef<number | null>(null);
  const settledRef = useRef(false);

  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  useEffect(() => {
    if (showFair) setSeedDraft(diceStore.get().clientSeed);
  }, [showFair]);

  // rolling → compute & settle (single fetch)
  useEffect(() => {
    if (round.phase !== "rolling" || !activeBet) return;
    let alive = true;
    if (tickIntervalRef.current == null) {
      tickIntervalRef.current = window.setInterval(() => sfx.play("tick"), 200);
    }
    const seed = diceStore.get().clientSeed || DEFAULT_CLIENT_SEED;
    void computeRoll({ serverSeed: SERVER_SEED, clientSeed: seed, nonce: activeBet.nonce }).then(
      (roll) => {
        if (!alive) return;
        const won = isWin(roll, activeBet.target, activeBet.mode);
        const pm = payoutMultiplier(winChance(activeBet.target, activeBet.mode));
        const profit = won ? profitOf(activeBet.amount, pm, mode) : -activeBet.amount;
        if (won) {
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
        recordSessionOutcome({
          outcome: won ? "win" : "loss",
          profit,
          multiplier: won ? pm : undefined,
        });
        sfx.play(won ? "win" : "loss");
        settledRef.current = true;
      },
    );
    return () => {
      alive = false;
      if (tickIntervalRef.current != null) {
        window.clearInterval(tickIntervalRef.current);
        tickIntervalRef.current = null;
      }
    };
  }, [round.phase, activeBet, mode, credit, sfx]);

  // idle 복귀 → activeBet 클리어 + nonce++ (Dice 현행 유지)
  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    settledRef.current = false;
    setActiveBet(null);
    diceStore.set((s) => ({ ...s, nonce: s.nonce + 1 }));
  }, [round.phase]);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (!round.isIdle || activeBet || amount <= 0) return;
      const currentNonce = diceStore.get().nonce;
      const ok = await tryDebit(amount, { game: "dice", roundId: `n${currentNonce}` });
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
      setActiveBet({
        amount,
        target: diceStore.get().target,
        mode: diceStore.get().diceMode,
        liveBetId,
        nonce: currentNonce,
      });
      sfx.play("bet");
      round.place();
    },
    [round, activeBet, mode, tryDebit, sfx],
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
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    if (next === diceStore.get().clientSeed) {
      setShowFair(false);
      return;
    }
    diceStore.set((s) => ({
      ...s,
      clientSeed: next,
      nonce: 0,
      lastOutcome: null,
      lastRoll: null,
    }));
    setActiveBet(null);
    settledRef.current = false;
    appToast.game.bet({ amount: "시드 변경됨 · nonce 0 리셋" });
    setShowFair(false);
  }, [seedDraft]);

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
              items={history.map((h) => ({ id: h.id, multiplier: h.roll }))}
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
            canPlace={round.isIdle && !activeBet}
            hasActiveBet={false}
            balance={balance}
            lastOutcome={lastOutcome}
            showAutoTarget={false}
            onPlace={(amount) => {
              diceStore.set((s) => ({ ...s, pendingAmount: amount }));
              void handlePlace(amount);
            }}
            onCashout={() => {}}
          />
        }
      />

      <LiveBetsFeed game="dice" limit={10} />

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer="시드 변경 시 nonce 0 리셋. 동일 시드/라운드는 항상 같은 결과를 만듭니다."
      />
    </div>
  );
}
