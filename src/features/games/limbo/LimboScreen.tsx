/**
 * LimboScreen — ROUND L-2-pre. 단일 슬롯 환원. Crash/Mines와 동형의 single-slot 패턴.
 *
 * 변경 (vs ROUND I)
 *  - 멀티 슬롯(activeRounds[2] / activeSlot / lastOutcomeBySlot) 전면 제거.
 *  - 단일 `useGameRound` + 단일 LimboDisplay + 단일 StakeBetPanel.
 *  - 마운트 시 1회: legacy `pendingLegacyRefunds` → demo 지갑만 로컬 정리 (RPC refund 없음)
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
import { BetSummaryPanel } from "@/shared/games/ui/BetSummaryPanel";
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
import { userLiveBetFallback } from "@/shared/livefeed/userLiveBet";
import { liveFeedBetIdForRound } from "@/lib/api/liveFeedMap";
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
import { wallet } from "@/shared/wallet/walletStore";
import { PF_BLOCK_ACTIVE_ROUND_MSG } from "@/shared/games/ui/pfPolicy";
import {
  clearRealSession,
  fetchRealSession,
  nonceFromRoundId,
  syncRealSession,
} from "@/shared/games/gameSessionHelpers";
import {
  notifyPfSeedChanged,
  LIMBO_RESULT_FLASH_DELAY_MS,
  useRoundResultFlash,
} from "@/shared/games/ui/gameOutcomePolicy";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode, useRegisterRightRail } from "@/shared/layout/useGameLayout";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { LimboDisplay } from "./LimboDisplay";
import { LimboTargetStepper } from "./LimboTargetStepper";
import { LimboRightRail } from "./LimboRightRail";

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
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const isDesktop = useDesktopLayout();
  const rightRailNode = useMemo(() => <LimboRightRail />, []);
  useRegisterRightRail(rightRailNode);
  const nonce = limboStore.use((s) => s.nonce);
  const history = limboStore.use((s) => s.history);
  const target = limboStore.use((s) => s.target);
  const pendingAmount = limboStore.use((s) => s.pendingAmount);
  const clientSeed = limboStore.use((s) => s.clientSeed);
  const activeRound = limboStore.use((s) => s.activeRound);
  const lastOutcome = limboStore.use((s) => s.lastOutcome);

  const round = useGameRound({ rollingMs: 700, settledMs: 900 });

  const [resultCrash, setResultCrash] = useState<number | null>(null);
  const [pendingResult, setPendingResult] = useState<Result | null>(null);
  const flashResult = useRoundResultFlash(pendingResult, LIMBO_RESULT_FLASH_DELAY_MS);
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

  const hydrateActiveRound = useCallback(
    (ar: ActiveLimboRound) => {
      liveBetsStore.ensureUserPending({
        id: ar.liveBetId,
        user: "나의_베팅",
        game: "limbo",
        amount: ar.amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      round.place();
    },
    [round, mode],
  );

  // 마운트 복원 (1회) — real: server SSOT, demo: localStorage
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const applyLocal = () => {
      const ar = limboStore.get().activeRound;
      if (ar) hydrateActiveRound(ar);
    };

    if (mode !== "real") {
      applyLocal();
      return;
    }

    void fetchRealSession("limbo").then((row) => {
      if (row) {
        const cs = row.client_state as {
          nonce?: number;
          target?: number;
          live_bet_id?: string;
          placed_at?: number;
        };
        const local = limboStore.get().activeRound;
        const ar: ActiveLimboRound = {
          nonce: cs.nonce ?? nonceFromRoundId(row.round_id),
          amount: row.bet_amount,
          target: cs.target ?? limboStore.get().target,
          liveBetId: local?.liveBetId ?? cs.live_bet_id ?? `lb_limbo_${row.round_id}`,
          placedAt: cs.placed_at ?? Date.now(),
          betMode: "real",
        };
        limboStore.set((s) => ({ ...s, activeRound: ar }));
        hydrateActiveRound(ar);
        return;
      }
      applyLocal();
    });
  }, [mode, hydrateActiveRound]);

  // Legacy v1 multi-slot → demo 지갑만 로컬 정리 (1회). Stake-like: no RPC refund.
  useEffect(() => {
    if (drainedRef.current) return;
    drainedRef.current = true;
    const pending = limboStore.get().pendingLegacyRefunds;
    if (!pending || pending.length === 0) return;
    for (const { amount } of pending) {
      wallet.refund("demo", amount);
    }
    limboStore.set((s) => ({ ...s, pendingLegacyRefunds: [] }));
  }, []);

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
    liveBetsStore.settle(
      ar.liveBetId,
      {
        multiplier: won ? mult : null,
        profit: won ? +profit.toFixed(2) : -ar.amount,
        status: won ? "win" : "loss",
      },
      userLiveBetFallback("limbo", ar.amount, mode),
    );
    recordSessionOutcome({
      outcome: won ? "win" : "loss",
      profit,
      multiplier: won ? mult : undefined,
    });
    sfx.play(won ? "win" : "loss");
    if (won && mult >= 50) sfx.play("jackpot");
    settledRef.current = true;
    setPendingResult({ won, profit, mult, nonce: ar.nonce });
    if (ar.betMode === "real") clearRealSession("limbo", `n${ar.nonce}`);
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
    setPendingResult(null);
  }, [round.phase]);

  // Place
  const place = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const currentNonce = limboStore.get().nonce;
      const roundId = `n${currentNonce}`;
      const ok = await tryDebit(amount, { game: "limbo", roundId });
      if (!ok) return;
      const t = limboStore.get().target;
      const liveBetId = liveBetsStore.push({
        id: liveFeedBetIdForRound("limbo", roundId),
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
        betMode: mode,
      };
      limboStore.set((s) => ({
        ...s,
        nonce: s.nonce + 1,
        pendingAmount: amount,
        activeRound: ar,
      }));
      if (mode === "real") {
        syncRealSession("limbo", `n${currentNonce}`, amount, {
          nonce: currentNonce,
          target: t,
          live_bet_id: liveBetId,
          placed_at: ar.placedAt,
        });
      }
      setResultCrash(null);
      round.place();
      sfx.play("bet");
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

  // PF: apply new seed — 진행 중 라운드 있으면 차단 (Dice/Wheel 동형)
  const applySeed = useCallback(() => {
    if (limboStore.get().activeRound || !round.isIdle) {
      appToast.raw.error(PF_BLOCK_ACTIVE_ROUND_MSG);
      return;
    }
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    if (next === clientSeed) {
      setShowFair(false);
      return;
    }
    limboStore.set((s) => ({
      ...s,
      clientSeed: next,
      nonce: 0,
      lastOutcome: null,
    }));
    setResultCrash(null);
    settledRef.current = false;
    notifyPfSeedChanged();
    setShowFair(false);
  }, [seedDraft, clientSeed, round.isIdle]);

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
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={activeRound?.amount ?? pendingAmount}
            targetMultiplier={displayTarget}
          />
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
            defaultAmount={pendingAmount}
            onAmountChange={(amount) => limboStore.set((s) => ({ ...s, pendingAmount: amount }))}
            onPlace={(amount) => {
              void place(amount);
            }}
            onCashout={() => {
              /* single-step: cashout not used */
            }}
          />
        }
      />

      {!isDesktop && <LiveBetsFeed game="limbo" limit={10} />}

      {flashResult && (
        <>
          <RoundResultCard
            outcome={flashResult.won ? "win" : "loss"}
            profit={flashResult.profit}
            multiplier={flashResult.mult}
            nonce={flashResult.nonce}
            onDone={() => setPendingResult(null)}
          />
          <div className="pointer-events-auto absolute right-4 top-[calc(33%+4.5rem)] z-20">
            <ShareResultButton
              renderToCanvas={(_c, ctx) => {
                const w = _c.width;
                const h = _c.height;
                ctx.fillStyle = flashResult.won ? "oklch(0.78 0.18 90)" : "oklch(0.62 0.2 25)";
                ctx.font = "bold 28px system-ui";
                ctx.textAlign = "center";
                ctx.fillText(flashResult.won ? "LIMBO WIN" : "LIMBO LOSS", w / 2, 60);
                ctx.fillStyle = "#fff";
                ctx.font = "bold 36px system-ui";
                ctx.fillText(`${flashResult.mult.toFixed(2)}x`, w / 2, h / 2 + 8);
                ctx.font = "16px system-ui";
                ctx.fillText(
                  `#${flashResult.nonce}  ${flashResult.profit >= 0 ? "+" : ""}${flashResult.profit.toFixed(2)}`,
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
        footer="진행 중 라운드가 있으면 시드 변경 불가. 이탈 시 라운드는 저장되어 복귀 시 이어집니다."
      />
    </div>
  );
}
