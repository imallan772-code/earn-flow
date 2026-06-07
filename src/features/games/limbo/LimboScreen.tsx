/**
 * LimboScreen — GA-G server authority + legacy PF fallback.
 *
 * Server path (GA-G): limbo_place_v1 instant settle → client animation only.
 *
 * nonce: server path uses next_nonce from RPC; legacy place → nonce++.
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
import { PfVerifyPageLink } from "@/shared/games/ui/PfVerifyPageLink";
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
import { usePfSession } from "@/shared/games/hooks/usePfSession";
import { useGameAuthorityFlag } from "@/shared/games/hooks/useGameAuthorityFlag";
import {
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
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { useAuth } from "@/features/auth/AuthContext";
import { limboComplete, limboPlace } from "@/lib/api/limboSession";
import { getGameActiveSession } from "@/lib/api/gameSessions";
import { toIntegerPhonAmount } from "@/lib/api/walletSchemas";
import {
  activeLimboRoundFromSession,
  isLimboSessionConflict,
} from "@/lib/gameSessions/limboSessionUtils";
import { fetchRealSession, syncRealSession } from "@/shared/games/gameSessionHelpers";
import { syncRealBalance } from "@/shared/wallet/walletStore";
import { wallet } from "@/shared/wallet/walletStore";
import {
  notifyPfSeedChanged,
  LIMBO_RESULT_FLASH_DELAY_MS,
  useRoundResultFlash,
} from "@/shared/games/ui/gameOutcomePolicy";
import { PF_BLOCK_ACTIVE_ROUND_MSG } from "@/shared/games/ui/pfPolicy";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useRegisterMainMode, useRegisterRightRail } from "@/shared/layout/useGameLayout";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { LimboDisplay } from "./LimboDisplay";
import { LimboTargetStepper } from "./LimboTargetStepper";
import { LimboRightRail } from "./LimboRightRail";

const LEGACY_PF_SEED = "phonara-limbo-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

interface Result {
  won: boolean;
  profit: number;
  mult: number;
  nonce: number;
}

export function LimboScreen() {
  useRegisterMainMode("game");
  const { status: authStatus } = useAuth();
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
  const serverCreditDoneRef = useRef(false);
  const placeInFlightRef = useRef(false);
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const pf = usePfSession("limbo", LEGACY_PF_SEED, DEFAULT_CLIENT_SEED, {
    clientSeed: clientSeed || DEFAULT_CLIENT_SEED,
  });
  const limboServerFlag = useGameAuthorityFlag("limbo_server_settle");
  const canUseServerAuthority =
    isSupabaseConfigured() &&
    authStatus === "authenticated" &&
    pf.ready &&
    !pf.legacyFallback &&
    limboServerFlag;
  const sfx = useSfx();

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

  // Resume-First: server SSOT on remount (GA-G §5.2).
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const applyLocal = () => {
      const ar = limboStore.get().activeRound;
      if (ar) hydrateActiveRound(ar);
    };

    if (!isSupabaseConfigured() || authStatus !== "authenticated") {
      applyLocal();
      return;
    }

    void fetchRealSession("limbo").then((row) => {
      if (row) {
        const local = limboStore.get().activeRound;
        const ar = activeLimboRoundFromSession(row, { liveBetId: local?.liveBetId });
        limboStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
        hydrateActiveRound(ar);
        return;
      }
      applyLocal();
    }).catch(applyLocal);
  }, [authStatus, hydrateActiveRound]);

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

  const settleFromOutcome = useCallback(
    (
      ar: ActiveLimboRound,
      crash: number,
      won: boolean,
      mult: number,
      skipRealCredit: boolean,
    ) => {
      const profit = won ? profitOf(ar.amount, mult, mode) : -ar.amount;
      setResultCrash(crash);
      if (won && !skipRealCredit) {
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
    },
    [mode, credit, sfx],
  );

  // rolling → server outcome
  useEffect(() => {
    if (round.phase !== "rolling") return;
    const ar = limboStore.get().activeRound;
    if (!ar) return;
    sfx.play("tick");

    if (ar.crashPoint != null && ar.won != null) {
      const mult = ar.payoutMultiplier ?? payoutMultiplier(ar.target);
      const skipRealCredit =
        ar.betMode === "real" && !!ar.serverSide && serverCreditDoneRef.current;
      settleFromOutcome(ar, ar.crashPoint, ar.won, mult, skipRealCredit);
    }
  }, [round.phase, pf.serverSeed, settleFromOutcome, sfx]);

  // idle → clear session + nonce from server or ++
  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    const ar = limboStore.get().activeRound;
    const roundId = ar ? `n${ar.nonce}` : null;
    if (ar?.serverSide && roundId) {
      void limboComplete(roundId);
    }
    settledRef.current = false;
    serverCreditDoneRef.current = false;
    setResultCrash(null);
    setPendingResult(null);
    limboStore.set((s) => ({
      ...s,
      activeRound: null,
      nonce: ar?.nextNonce ?? (ar?.serverSide ? s.nonce : s.nonce),
    }));
  }, [round.phase, activeRound]);

  const place = useCallback(
    async (amount: number): Promise<boolean> => {
      if (!round.isIdle || amount <= 0 || !pf.ready || limboStore.get().activeRound) return false;
      const currentNonce = limboStore.get().nonce;
      const roundId = `n${currentNonce}`;
      const t = limboStore.get().target;

      if (canUseServerAuthority) {
        if (placeInFlightRef.current) return false;
        placeInFlightRef.current = true;
        const betAmount =
          mode === "real" ? toIntegerPhonAmount(amount) : Math.max(1, Math.round(amount));
        if (mode === "real" && betAmount == null) {
          placeInFlightRef.current = false;
          return false;
        }

        try {
          const existing = await getGameActiveSession("limbo");
          if (existing) {
            const local = limboStore.get().activeRound;
            const ar = activeLimboRoundFromSession(existing, { liveBetId: local?.liveBetId });
            limboStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
            hydrateActiveRound(ar);
            return true;
          }

          if (mode === "demo") {
            const ok = await tryDebit(amount, { game: "limbo", roundId });
            if (!ok) return false;
          }

          const seed = limboStore.get().clientSeed || DEFAULT_CLIENT_SEED;
          const res = await limboPlace({
            amount: betAmount ?? Math.max(1, Math.round(amount)),
            roundId,
            target: t,
            clientSeed: seed,
          });
          if (res.mode === "real") {
            serverCreditDoneRef.current = res.won;
            if (res.balance?.phon != null) syncRealBalance(res.balance.phon);
          }

          const liveBetId = liveBetsStore.push({
            id: liveFeedBetIdForRound("limbo", roundId),
            user: "나의_베팅",
            game: "limbo",
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            multiplier: null,
            profit: null,
            status: "pending",
            mode,
            isMe: true,
          });

          const ar: ActiveLimboRound = {
            nonce: currentNonce,
            amount: mode === "demo" ? amount : (betAmount ?? amount),
            target: t,
            liveBetId,
            placedAt: Date.now(),
            betMode: mode,
            serverSide: true,
            crashPoint: res.crash_point,
            won: res.won,
            payoutMultiplier: res.payout_multiplier,
            nextNonce: currentNonce + 1,
          };
          limboStore.set((s) => ({
            ...s,
            pendingAmount: amount,
            activeRound: ar,
          }));
          setResultCrash(null);
          sfx.play("bet");
          round.place();
          return true;
        } catch (err) {
          if (isLimboSessionConflict(err)) {
            try {
              const row = await getGameActiveSession("limbo");
              if (row) {
                const local = limboStore.get().activeRound;
                const ar = activeLimboRoundFromSession(row, { liveBetId: local?.liveBetId });
                limboStore.set((s) => ({ ...s, activeRound: ar, nonce: ar.nextNonce ?? ar.nonce }));
                hydrateActiveRound(ar);
                return true;
              }
            } catch {
              /* fall through */
            }
          }
          appToast.raw.error("베팅에 실패했습니다 (진행 중 라운드가 있거나 네트워크 오류)");
          return false;
        } finally {
          placeInFlightRef.current = false;
        }
      }

      const ok = await tryDebit(amount, { game: "limbo", roundId });
      if (!ok) return false;
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
      return true;
    },
    [round, tryDebit, mode, sfx, pf.ready, canUseServerAuthority, hydrateActiveRound],
  );

  const setTarget = useCallback(
    (next: number) => limboStore.set((s) => ({ ...s, target: next })),
    [],
  );
  const stepTarget = useCallback(
    (delta: number) => limboStore.set((s) => ({ ...s, target: Math.max(1.01, s.target + delta) })),
    [],
  );

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
    void pf.setClientSeed(next).then(() => {
      limboStore.set((s) => ({
        ...s,
        clientSeed: next,
        nonce: 0,
        lastOutcome: null,
        activeRound: null,
      }));
      setResultCrash(null);
      settledRef.current = false;
      notifyPfSeedChanged();
      setShowFair(false);
    }).catch(() => {
      appToast.raw.error("시드 변경에 실패했습니다");
    });
  }, [seedDraft, clientSeed, round.isIdle, pf]);

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
        <code className="break-all text-[10px] text-(--color-cyan)">{pf.commitHash || "로딩 중..."}</code>
      ),
      copyText: pf.commitHash || undefined,
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
            canPlace={round.isIdle && !activeRound && pf.ready}
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
            onPlace={(amount) => place(amount)}
            onCashout={() => {
              /* single-step: cashout not used */
            }}
            serverAutoBet={{
              game: "limbo",
              getBetParams: () => ({ target: limboStore.get().target }),
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
        footer={
          <>
            <p>
              진행 중 라운드가 있으면 시드 변경 불가. 이탈 시 라운드는 저장되어 복귀 시 이어집니다.
            </p>
            <PfVerifyPageLink
              game="limbo"
              serverSeed={pf.serverSeed}
              serverSeedHash={pf.commitHash}
              clientSeed={seedDraft.trim() || DEFAULT_CLIENT_SEED}
              nonce={nonce}
            />
          </>
        }
      />
    </div>
  );
}
