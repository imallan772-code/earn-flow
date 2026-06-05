/**
 * LimboScreen — ROUND I 끝판왕. Manual×2 슬롯 + active 슬롯 auto, useGameRound × 2,
 * ROUND 0 공통 인프라 wiring (SFX, HistoryPillStrip, ProvablyFairModal, RoundResultCard,
 * ShareResultButton, SessionStatsBar, recordSessionOutcome, useHotkeys).
 *
 * 불변
 *  - LimboEngine.ts 0 diff
 *  - StakeBetPanel props 계약 변경 0
 *  - useAutoBetController 0 diff
 *  - localStorage key = phonara.gamestate.limbo.v1 (version 유지)
 *
 * 멀티슬롯 정책
 *  - 슬롯 2개 = manual 전용. Auto 탭은 activeSlot 1개에서만 (full panel) 노출.
 *  - 슬롯 전환 = panel key remount → auto 자동 정지.
 *
 * nonce
 *  - place(slot) 성공 시 global nonce++. ActiveLimboRound.nonce 에 스냅샷.
 *  - idle 복귀 시 nonce 변경 없음 (두 슬롯 동시 진행 시 nonce 중복 방지).
 *
 * 복원 (이중 차감 절대 금지)
 *  - 마운트 시 activeRounds[i] != null → rounds[i].place() (state hydrate만).
 *    tryDebit / liveBetsStore.push 0회.
 *
 * TODO(real-money): computeCrashPoint는 Edge Function 위임.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { HistoryPillStrip } from "@/shared/games/ui/HistoryPillStrip";
import { ProvablyFairModal, type ProvablyFairRow } from "@/shared/games/ui/ProvablyFairModal";
import { RoundResultCard } from "@/shared/games/ui/RoundResultCard";
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { ShareResultButton } from "@/shared/games/ui/ShareResultButton";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { LIMBO_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import {
  computeCrashPoint,
  isWin,
  payoutMultiplier,
  winChance,
} from "@/shared/games/limbo/LimboEngine";
import {
  type ActiveLimboRound,
  type LimboOutcome,
  limboStore,
} from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";
import { LimboMultiSlot } from "./LimboMultiSlot";
import { LimboTargetStepper } from "./LimboTargetStepper";

const SERVER_SEED = "phonara-limbo-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

interface SlotResult {
  won: boolean;
  profit: number;
  mult: number;
  nonce: number;
}

export function LimboScreen() {
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = limboStore.use((s) => s.nonce);
  const history = limboStore.use((s) => s.history);
  const target = limboStore.use((s) => s.target);
  const pendingAmount = limboStore.use((s) => s.pendingAmount);
  const clientSeed = limboStore.use((s) => s.clientSeed);
  const activeSlot = limboStore.use((s) => s.activeSlot);
  const activeRounds = limboStore.use((s) => s.activeRounds);
  const lastOutcomeBySlot = limboStore.use((s) => s.lastOutcomeBySlot);

  const round0 = useGameRound({ rollingMs: 700, settledMs: 900 });
  const round1 = useGameRound({ rollingMs: 700, settledMs: 900 });
  const rounds = [round0, round1] as const;

  const [resultCrash, setResultCrash] = useState<[number | null, number | null]>([null, null]);
  const [recentResult, setRecentResult] = useState<{ slot: 0 | 1; result: SlotResult } | null>(
    null,
  );
  const settledRefs = [useRef(false), useRef(false)] as const;
  const restoredRef = useRef(false);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const sfx = useSfx();

  // PF commit hash
  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // Seed draft sync when modal opens
  useEffect(() => {
    if (showFair) setSeedDraft(clientSeed);
  }, [showFair, clientSeed]);

  // Restore activeRounds (once)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const ars = limboStore.get().activeRounds;
    if (ars[0]) round0.place();
    if (ars[1]) round1.place();
    // No tryDebit / liveBetsStore.push — pure state hydrate.
  }, [round0, round1]);

  const settleSlot = useCallback(
    async (slot: 0 | 1) => {
      const ar = limboStore.get().activeRounds[slot];
      if (!ar) return;
      const seed = limboStore.get().clientSeed || DEFAULT_CLIENT_SEED;
      const crash = await computeCrashPoint({
        serverSeed: SERVER_SEED,
        clientSeed: seed,
        nonce: ar.nonce,
      });
      const won = isWin(crash, ar.target);
      const mult = payoutMultiplier(ar.target);
      const profit = won ? profitOf(ar.amount, mult, mode) : -ar.amount;
      setResultCrash((prev) => {
        const next: [number | null, number | null] = [prev[0], prev[1]];
        next[slot] = crash;
        return next;
      });
      if (won) {
        void credit(ar.amount + profit, mult, { game: "limbo", roundId: `n${ar.nonce}` });
      }
      const outcome: LimboOutcome = {
        outcome: won ? "win" : "loss",
        profit,
        nonce: ar.nonce,
        crashPoint: crash,
        target: ar.target,
      };
      limboStore.set((s) => {
        const ars = [...s.activeRounds] as [ActiveLimboRound | null, ActiveLimboRound | null];
        ars[slot] = null;
        const slotOutcomes = [...s.lastOutcomeBySlot] as [LimboOutcome | null, LimboOutcome | null];
        slotOutcomes[slot] = outcome;
        return {
          ...s,
          activeRounds: ars,
          history: [
            { id: `n${ar.nonce}`, crashPoint: crash, target: ar.target, win: won },
            ...s.history,
          ].slice(0, 30),
          lastOutcome: outcome,
          lastOutcomeBySlot: slotOutcomes,
        };
      });
      liveBetsStore.update(ar.liveBetId, {
        multiplier: won ? mult : null,
        profit: won ? +profit.toFixed(2) : -ar.amount,
        status: won ? "win" : "loss",
      });
      recordSessionOutcome({
        outcome: won ? "win" : "loss",
        profit,
        multiplier: won ? mult : undefined,
      });
      sfx.play(won ? "win" : "loss");
      if (won && mult >= 50) sfx.play("jackpot");
      if (won) appToast.game.win({ amount: formatPHON(profit) });
      else appToast.game.lose({ amount: formatPHON(ar.amount) });
      settledRefs[slot].current = true;
      setRecentResult({ slot, result: { won, profit, mult, nonce: ar.nonce } });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, credit, sfx],
  );

  // rolling → compute & settle (per slot)
  useEffect(() => {
    if (round0.phase !== "rolling") return;
    sfx.play("tick");
    void settleSlot(0);
  }, [round0.phase, settleSlot, sfx]);
  useEffect(() => {
    if (round1.phase !== "rolling") return;
    sfx.play("tick");
    void settleSlot(1);
  }, [round1.phase, settleSlot, sfx]);

  // back to idle → clear resultCrash per slot
  useEffect(() => {
    if (round0.phase !== "idle" || !settledRefs[0].current) return;
    settledRefs[0].current = false;
    setResultCrash((prev) => [null, prev[1]]);
  }, [round0.phase, settledRefs]);
  useEffect(() => {
    if (round1.phase !== "idle" || !settledRefs[1].current) return;
    settledRefs[1].current = false;
    setResultCrash((prev) => [prev[0], null]);
  }, [round1.phase, settledRefs]);

  // Place
  const placeSlot = useCallback(
    async (slot: 0 | 1, amount: number) => {
      const r = rounds[slot];
      if (!r.isIdle || amount <= 0) return;
      const currentNonce = limboStore.get().nonce;
      const ok = await tryDebit(amount, { game: "limbo", roundId: `n${currentNonce}` });
      if (!ok) return;
      const slotTarget = limboStore.get().target;
      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "limbo",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      const ar: ActiveLimboRound = {
        nonce: currentNonce,
        amount,
        target: slotTarget,
        liveBetId,
        placedAt: Date.now(),
        slot,
      };
      limboStore.set((s) => {
        const ars = [...s.activeRounds] as [ActiveLimboRound | null, ActiveLimboRound | null];
        ars[slot] = ar;
        return {
          ...s,
          nonce: s.nonce + 1,
          pendingAmount: amount,
          activeRounds: ars,
        };
      });
      setResultCrash((prev) => {
        const next: [number | null, number | null] = [prev[0], prev[1]];
        next[slot] = null;
        return next;
      });
      r.place();
      sfx.play("bet");
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [rounds, tryDebit, mode, sfx],
  );

  const setTarget = useCallback(
    (next: number) => limboStore.set((s) => ({ ...s, target: next })),
    [],
  );
  const stepTarget = useCallback(
    (delta: number) => limboStore.set((s) => ({ ...s, target: Math.max(1.01, s.target + delta) })),
    [],
  );
  const setActiveSlot = useCallback(
    (slot: 0 | 1) =>
      limboStore.set((s) => (s.activeSlot === slot ? s : { ...s, activeSlot: slot })),
    [],
  );

  // PF: apply new seed
  const applySeed = useCallback(() => {
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    if (next === clientSeed) {
      setShowFair(false);
      return;
    }
    limboStore.set((s) => ({
      ...s,
      clientSeed: next,
      nonce: 0,
      activeRounds: [null, null],
      lastOutcome: null,
      lastOutcomeBySlot: [null, null],
    }));
    setResultCrash([null, null]);
    settledRefs[0].current = false;
    settledRefs[1].current = false;
    appToast.game.bet({ amount: "시드 변경됨 · nonce 0 리셋" });
    setShowFair(false);
  }, [seedDraft, clientSeed, settledRefs]);

  // Hotkeys (micro-fix #2, #4)
  const hotkeys = useMemo<HotkeyMap>(
    () => ({
      " ": () => {
        const s = limboStore.get();
        void placeSlot(s.activeSlot, s.pendingAmount);
      },
      ArrowUp: (e) => {
        e.preventDefault();
        stepTarget(+0.1);
      },
      ArrowDown: (e) => {
        e.preventDefault();
        stepTarget(-0.1);
      },
      "Shift+ArrowUp": (e) => {
        e.preventDefault();
        stepTarget(+1.0);
      },
      "Shift+ArrowDown": (e) => {
        e.preventDefault();
        stepTarget(-1.0);
      },
      "1": () => setActiveSlot(0),
      "2": () => setActiveSlot(1),
      p: () => setShowFair(true),
      m: () => sfx.toggleMute(),
    }),
    [placeSlot, stepTarget, setActiveSlot, sfx],
  );
  useHotkeys(hotkeys);

  // Slot view-models
  const slots = useMemo(
    () =>
      ([0, 1] as const).map((i) => {
        const r = rounds[i];
        const ar = activeRounds[i];
        const last = lastOutcomeBySlot[i];
        const won =
          r.phase === "rolling"
            ? null
            : resultCrash[i] != null
              ? isWin(resultCrash[i] as number, ar?.target ?? last?.target ?? target)
              : last
                ? last.outcome === "win"
                : null;
        return {
          slot: i,
          phase: r.phase as "idle" | "rolling" | "settled",
          resultCrash: resultCrash[i],
          displayTarget: ar?.target ?? target,
          won,
          isIdle: r.isIdle,
          hasActiveBet: !r.isIdle,
          lastOutcome: last,
          bettingRoundKey: ar?.nonce ?? nonce,
        };
      }) as unknown as [
        Parameters<typeof LimboMultiSlot>[0]["slots"][0],
        Parameters<typeof LimboMultiSlot>[0]["slots"][1],
      ],
    [rounds, activeRounds, lastOutcomeBySlot, resultCrash, target, nonce],
  );

  const winPct = winChance(target);
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
      label: "현재 목표 배수",
      content: <code className="font-numeric text-gold">{target.toFixed(2)}x</code>,
    },
    {
      label: "다음 픽 승률",
      content: <code className="font-numeric text-(--color-cyan)">{winPct.toFixed(2)}%</code>,
    },
  ];

  return (
    <div className="relative flex flex-col gap-2">
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
              <h1 className="text-xl font-extrabold leading-tight">Limbo</h1>
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
        rulesCard={<GameRulesCard rules={LIMBO_RULES} onVerify={() => setShowFair(true)} />}
        historyStrip={
          <div className="flex flex-col gap-1.5">
            <HistoryPillStrip
              items={history.map((h) => ({ id: h.id, multiplier: h.crashPoint }))}
              onPillClick={() => setShowFair(true)}
            />
            <SessionStatsBar />
          </div>
        }
        displayArea={
          <LimboMultiSlot
            slots={slots}
            activeSlot={activeSlot}
            balance={balance}
            onActivate={setActiveSlot}
            onPlace={(slot, amount) => {
              limboStore.set((s) => ({ ...s, pendingAmount: amount }));
              void placeSlot(slot, amount);
            }}
          />
        }
        controls={
          <LimboTargetStepper target={target} disabled={pendingAmount < 0} onChange={setTarget} />
        }
        banner={<DemoLowBanner />}
        betPanel={<></>}
      />

      <LiveBetsFeed game="limbo" limit={10} />

      {recentResult && (
        <>
          <RoundResultCard
            outcome={recentResult.result.won ? "win" : "loss"}
            profit={recentResult.result.profit}
            multiplier={recentResult.result.mult}
            nonce={recentResult.result.nonce}
            onDone={() => setRecentResult(null)}
          />
          <div className="pointer-events-auto absolute right-4 top-[calc(33%+4.5rem)] z-20">
            <ShareResultButton
              renderToCanvas={(_c, ctx) => {
                const w = _c.width;
                const h = _c.height;
                ctx.fillStyle = recentResult.result.won
                  ? "oklch(0.78 0.18 90)"
                  : "oklch(0.62 0.2 25)";
                ctx.font = "bold 28px system-ui";
                ctx.textAlign = "center";
                ctx.fillText(recentResult.result.won ? "LIMBO WIN" : "LIMBO LOSS", w / 2, 60);
                ctx.fillStyle = "#fff";
                ctx.font = "bold 36px system-ui";
                ctx.fillText(`${recentResult.result.mult.toFixed(2)}x`, w / 2, h / 2 + 8);
                ctx.font = "16px system-ui";
                ctx.fillText(
                  `#${recentResult.result.nonce}  ${recentResult.result.profit >= 0 ? "+" : ""}${recentResult.result.profit.toFixed(2)}`,
                  w / 2,
                  h - 24,
                );
              }}
            />
          </div>
        </>
      )}

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer="시드 변경 시 nonce 0 리셋 + 진행 중 라운드 폐기. 동일 시드/라운드는 항상 같은 결과를 만듭니다."
      />
    </div>
  );
}
