/**
 * LimboScreen — ROUND L-2-pre. 단일 슬롯 환원. Crash/Mines와 동형의 single-slot 패턴.
 *
 * 변경 (vs ROUND I)
 *  - 멀티 슬롯(activeRounds[2] / activeSlot / lastOutcomeBySlot) 전면 제거.
 *  - 단일 `useGameRound` + 단일 LimboDisplay + 단일 StakeBetPanel.
 *  - 마운트 시 1회: `pendingLegacyRefunds` drain → `useGameWallet.refund({ game, roundId: n${nonce} })`
 *    → 직후 store에서 비움 (이중 refund 방지).
 *
 * 불변
 *  - LimboEngine.ts 0 diff
 *  - StakeBetPanel props 계약 0 diff
 *  - localStorage key = phonara.gamestate.limbo.v2 (v1 → v2 마이그레이트는 store에서 처리)
 *
 * nonce
 *  - place 성공 시 global nonce++. ActiveLimboRound.nonce 가 그 스냅샷.
 *
 * 복원 (새로고침 시)
 *  - activeRound != null → round.place() 호출 (state hydrate만, tryDebit / liveBetsStore.push 0회).
 *
 * TODO(real-money): computeCrashPoint를 Edge Function으로 이전.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { GameShell } from "@/shared/games/shell/GameShell";
import { useGameRound } from "@/shared/games/shell/useGameRound";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
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
import { useUnmountRefund } from "@/shared/wallet/useUnmountRefund";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode } from "@/shared/layout/useGameLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";
import { LimboDisplay } from "./LimboDisplay";
import { LimboTargetStepper } from "./LimboTargetStepper";

const SERVER_SEED = "phonara-limbo-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

interface Result {
  won: boolean;
  profit: number;
  mult: number;
  nonce: number;
}

export function LimboScreen() {
  useRegisterMainMode("game");
  const { mode, balance, tryDebit, credit, refund } = useGameWallet();
  const nonce = limboStore.use((s) => s.nonce);
  const history = limboStore.use((s) => s.history);
  const target = limboStore.use((s) => s.target);
  const pendingAmount = limboStore.use((s) => s.pendingAmount);
  const clientSeed = limboStore.use((s) => s.clientSeed);
  const activeRound = limboStore.use((s) => s.activeRound);
  const lastOutcome = limboStore.use((s) => s.lastOutcome);

  const round = useGameRound({ rollingMs: 700, settledMs: 900 });

  const [resultCrash, setResultCrash] = useState<number | null>(null);
  const [recentResult, setRecentResult] = useState<Result | null>(null);
  const settledRef = useRef(false);
  const restoredRef = useRef(false);
  const drainedRef = useRef(false);
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

  // 마운트 복원 (1회)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (limboStore.get().activeRound) round.place();
    // No tryDebit / liveBetsStore.push — pure state hydrate.
  }, [round]);

  // Legacy v1 multi-slot fold → pendingLegacyRefunds drain (1회). 직후 store에서 비움.
  // refund 자체는 fire-and-forget (실패 시 다음 reload에 재시도; RPC idempotent).
  const refundRef = useRef(refund);
  refundRef.current = refund;
  useEffect(() => {
    if (drainedRef.current) return;
    drainedRef.current = true;
    const pending = limboStore.get().pendingLegacyRefunds;
    if (!pending || pending.length === 0) return;
    for (const { amount, nonce: n } of pending) {
      void refundRef
        .current(amount, { game: "limbo", roundId: `n${n}` })
        .catch(() => undefined);
    }
    // 즉시 클리어 → 재마운트/재진입 시 이중 refund 방지.
    limboStore.set((s) => ({ ...s, pendingLegacyRefunds: [] }));
  }, []);
  // Unmount: refund active bet (RPC idempotent, fire-and-forget) — SSOT
  useUnmountRefund(refund, () => {
    const ar = limboStore.get().activeRound;
    if (!ar) return null;
    return { amount: ar.amount, meta: { game: "limbo", roundId: `n${ar.nonce}` } };
  });


  const settle = useCallback(async () => {
    const ar = limboStore.get().activeRound;
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
    setResultCrash(crash);
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
    limboStore.set((s) => ({
      ...s,
      activeRound: null,
      history: [
        { id: `n${ar.nonce}`, crashPoint: crash, target: ar.target, win: won },
        ...s.history,
      ].slice(0, 30),
      lastOutcome: outcome,
    }));
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
    settledRef.current = true;
    setRecentResult({ won, profit, mult, nonce: ar.nonce });
  }, [mode, credit, sfx]);

  // rolling → compute & settle
  useEffect(() => {
    if (round.phase !== "rolling") return;
    sfx.play("tick");
    void settle();
  }, [round.phase, settle, sfx]);

  // back to idle → clear resultCrash
  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    settledRef.current = false;
    setResultCrash(null);
  }, [round.phase]);

  // Place
  const place = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const currentNonce = limboStore.get().nonce;
      const ok = await tryDebit(amount, { game: "limbo", roundId: `n${currentNonce}` });
      if (!ok) return;
      const t = limboStore.get().target;
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
        target: t,
        liveBetId,
        placedAt: Date.now(),
      };
      limboStore.set((s) => ({
        ...s,
        nonce: s.nonce + 1,
        pendingAmount: amount,
        activeRound: ar,
      }));
      setResultCrash(null);
      round.place();
      sfx.play("bet");
      appToast.game.bet({ amount: formatPHON(amount) });
    },
    [round, tryDebit, mode, sfx],
  );

  const setTarget = useCallback(
    (next: number) => limboStore.set((s) => ({ ...s, target: next })),
    [],
  );
  const stepTarget = useCallback(
    (delta: number) => limboStore.set((s) => ({ ...s, target: Math.max(1.01, s.target + delta) })),
    [],
  );

  // PF: apply new seed — active round 있으면 refund RPC 1회 후 reset
  const applySeed = useCallback(() => {
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    if (next === clientSeed) {
      setShowFair(false);
      return;
    }
    const ar = limboStore.get().activeRound;
    if (ar) {
      void refund(ar.amount, { game: "limbo", roundId: `n${ar.nonce}` }).catch(() => undefined);
      liveBetsStore.update(ar.liveBetId, {
        multiplier: null,
        profit: 0,
        status: "loss",
      });
    }
    limboStore.set((s) => ({
      ...s,
      clientSeed: next,
      nonce: 0,
      activeRound: null,
      lastOutcome: null,
    }));
    setResultCrash(null);
    settledRef.current = false;
    appToast.game.bet({ amount: "시드 변경됨 · nonce 0 리셋" });
    setShowFair(false);
  }, [seedDraft, clientSeed, refund]);

  // Hotkeys (slot 전환 키 제거)
  const hotkeys = useMemo<HotkeyMap>(
    () => ({
      " ": () => {
        const s = limboStore.get();
        void place(s.pendingAmount);
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
      p: () => setShowFair(true),
      m: () => sfx.toggleMute(),
    }),
    [place, stepTarget, sfx],
  );
  useHotkeys(hotkeys);

  const won =
    round.phase === "rolling"
      ? null
      : resultCrash != null
        ? isWin(resultCrash, activeRound?.target ?? lastOutcome?.target ?? target)
        : lastOutcome
          ? lastOutcome.outcome === "win"
          : null;

  const displayTarget = activeRound?.target ?? target;

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
    { label: "다음 라운드 nonce", content: <code className="font-numeric">{nonce}</code> },
    {
      label: "목표 배수",
      content: <code className="font-numeric text-gold">{target.toFixed(2)}x</code>,
    },
    {
      label: "승리 확률",
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
              검증
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
          <LimboDisplay
            slot={0}
            phase={round.phase as "idle" | "rolling" | "settled"}
            resultCrash={resultCrash}
            target={displayTarget}
            won={won}
            active
            onActivate={() => {
              /* single-slot: no-op */
            }}
          />
        }
        controls={
          <LimboTargetStepper target={target} disabled={pendingAmount < 0} onChange={setTarget} />
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            variant="full"
            showAutoTarget={false}
            canPlace={round.isIdle}
            hasActiveBet={!round.isIdle}
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
            bettingRoundKey={activeRound?.nonce ?? nonce}
            onPlace={(amount) => {
              limboStore.set((s) => ({ ...s, pendingAmount: amount }));
              void place(amount);
            }}
            onCashout={() => {
              /* single-step: cashout not used */
            }}
          />
        }
      />

      <LiveBetsFeed game="limbo" limit={10} />

      {recentResult && (
        <>
          <RoundResultCard
            outcome={recentResult.won ? "win" : "loss"}
            profit={recentResult.profit}
            multiplier={recentResult.mult}
            nonce={recentResult.nonce}
            onDone={() => setRecentResult(null)}
          />
          <div className="pointer-events-auto absolute right-4 top-[calc(33%+4.5rem)] z-20">
            <ShareResultButton
              renderToCanvas={(_c, ctx) => {
                const w = _c.width;
                const h = _c.height;
                ctx.fillStyle = recentResult.won
                  ? "oklch(0.78 0.18 90)"
                  : "oklch(0.62 0.2 25)";
                ctx.font = "bold 28px system-ui";
                ctx.textAlign = "center";
                ctx.fillText(recentResult.won ? "LIMBO WIN" : "LIMBO LOSS", w / 2, 60);
                ctx.fillStyle = "#fff";
                ctx.font = "bold 36px system-ui";
                ctx.fillText(`${recentResult.mult.toFixed(2)}x`, w / 2, h / 2 + 8);
                ctx.font = "16px system-ui";
                ctx.fillText(
                  `#${recentResult.nonce}  ${recentResult.profit >= 0 ? "+" : ""}${recentResult.profit.toFixed(2)}`,
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
        footer="시드 변경 시 nonce 0 리셋 + 다음 라운드부터 적용. 진행 중인 라운드는 단순 클리어됩니다."
      />
    </div>
  );
}
