/**
 * WheelScreen — ROUND J v1.2 끝판왕. Single-slot + Design B (WheelDisplay/WheelControls 분리).
 *
 * 불변
 *  - WheelEngine.ts 0 diff
 *  - StakeBetPanel / useAutoBetController 0 diff
 *  - localStorage key = phonara.gamestate.wheel.v1 (version 유지)
 *
 * nonce 정책
 *  - place() 성공 시 global nonce++. ActiveWheelRound.nonce 에 스냅샷.
 *  - idle 복귀 nonce++ effect 삭제 (audit patch).
 *
 * 복원 (이중 차감 절대 금지)
 *  - 마운트 시 activeRound != null → round.place() (state hydrate만).
 *    tryDebit / liveBetsStore.push 0회.
 *
 * 토스트 정책
 *  - 일반 win/loss/bet toast 제거 (Limbo 정렬).
 *  - jackpot (mult ≥ 9.0) → SFX `jackpot` + RewardBurst (Display 내부)만.
 *
 * TODO(real-money): spin은 Edge Function 위임. 테이블/계산은 그대로 재사용.
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
import { SessionStatsBar } from "@/shared/games/ui/SessionStatsBar";
import { recordSessionOutcome } from "@/shared/games/ui/sessionStats";
import { WHEEL_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { profitOf } from "@/shared/games/engine/houseEdge";
import { commitServerSeed } from "@/shared/games/engine/provablyFair";
import {
  expectedMultiplier,
  multiplierAt,
  spin,
  type WheelRisk,
  type WheelSegments,
} from "@/shared/games/wheel/WheelEngine";
import {
  type ActiveWheelRound,
  type WheelOutcome,
  wheelStore,
} from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { useSfx } from "@/shared/sfx/useSfx";
import { appToast } from "@/shared/ui/toast";
import { WheelDisplay } from "./WheelDisplay";
import { WheelControls } from "./WheelControls";

const SERVER_SEED = "phonara-wheel-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";
const RISK_ORDER: readonly WheelRisk[] = ["low", "medium", "high"];

export function WheelScreen() {
  const { mode, balance, tryDebit, credit } = useGameWallet();
  const nonce = wheelStore.use((s) => s.nonce);
  const history = wheelStore.use((s) => s.history);
  const lastOutcome = wheelStore.use((s) => s.lastOutcome);
  const risk = wheelStore.use((s) => s.risk);
  const segments = wheelStore.use((s) => s.segments);
  const pendingAmount = wheelStore.use((s) => s.pendingAmount);
  const activeRound = wheelStore.use((s) => s.activeRound);

  const round = useGameRound({ rollingMs: 3200, settledMs: 1200 });
  const [resultIndex, setResultIndex] = useState<number | null>(null);
  const [resultMult, setResultMult] = useState<number | null>(null);
  const [jackpotTrigger, setJackpotTrigger] = useState(0);
  const settledRef = useRef(false);
  const restoredRef = useRef(false);
  const [commit, setCommit] = useState("");
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const sfx = useSfx();
  const tickIntervalRef = useRef<number | null>(null);

  // PF commit hash
  useEffect(() => {
    commitServerSeed(SERVER_SEED).then(setCommit);
  }, []);

  // Seed draft sync
  useEffect(() => {
    if (showFair) setSeedDraft(wheelStore.get().clientSeed);
  }, [showFair]);

  // Restore activeRound (once) — state hydrate only.
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (wheelStore.get().activeRound) round.place();
    // No tryDebit / liveBetsStore.push.
  }, [round]);

  // Settle: rolling phase → spin & resolve.
  useEffect(() => {
    if (round.phase !== "rolling") return;
    const ar = wheelStore.get().activeRound;
    if (!ar) return;
    let alive = true;

    // tick SFX every 200ms during spin (reduced-motion handled inside useSfx)
    if (tickIntervalRef.current == null) {
      tickIntervalRef.current = window.setInterval(() => sfx.play("tick"), 200);
    }

    const seed = wheelStore.get().clientSeed || DEFAULT_CLIENT_SEED;
    void spin({ serverSeed: SERVER_SEED, clientSeed: seed, nonce: ar.nonce }, ar.segments).then(
      (idx) => {
        if (!alive) return;
        const mult = multiplierAt(ar.risk, ar.segments, idx);
        const won = mult > 0;
        const profit = won ? profitOf(ar.amount, mult, mode) : -ar.amount;
        setResultIndex(idx);
        setResultMult(mult);
        if (won) {
          void credit(ar.amount + profit, mult, { game: "wheel", roundId: `n${ar.nonce}` });
        }
        const outcome: WheelOutcome = {
          outcome: won ? "win" : "loss",
          profit,
          nonce: ar.nonce,
          risk: ar.risk,
          segments: ar.segments,
          index: idx,
          multiplier: mult,
        };
        wheelStore.set((s) => ({
          ...s,
          activeRound: null,
          history: [
            {
              id: `n${ar.nonce}`,
              risk: ar.risk,
              segments: ar.segments,
              index: idx,
              multiplier: mult,
              win: won,
            },
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
        if (won && mult >= 9.0) {
          sfx.play("jackpot");
          setJackpotTrigger((n) => n + 1);
        }
        // 일반 win/loss 토스트 제거 (Limbo 정렬).
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
  }, [round.phase, mode, credit, sfx]);

  // idle 복귀 → 결과 클리어. **nonce++ 없음 (audit patch).**
  useEffect(() => {
    if (round.phase !== "idle" || !settledRef.current) return;
    settledRef.current = false;
    setResultIndex(null);
    setResultMult(null);
  }, [round.phase]);

  const setRisk = useCallback((r: WheelRisk) => {
    wheelStore.set((s) => ({ ...s, risk: r }));
  }, []);
  const setSegmentsValue = useCallback((n: WheelSegments) => {
    wheelStore.set((s) => ({ ...s, segments: n }));
  }, []);
  const cycleRisk = useCallback((delta: number) => {
    const cur = wheelStore.get().risk;
    const idx = RISK_ORDER.indexOf(cur);
    const next = RISK_ORDER[(idx + delta + RISK_ORDER.length) % RISK_ORDER.length];
    wheelStore.set((s) => ({ ...s, risk: next }));
  }, []);

  const handlePlace = useCallback(
    async (amount: number) => {
      if (!round.isIdle || amount <= 0) return;
      const currentNonce = wheelStore.get().nonce;
      const ok = await tryDebit(amount, { game: "wheel", roundId: `n${currentNonce}` });
      if (!ok) return;
      const s0 = wheelStore.get();
      const liveBetId = liveBetsStore.push({
        user: "나의_베팅",
        game: "wheel",
        amount,
        multiplier: null,
        profit: null,
        status: "pending",
        mode,
        isMe: true,
      });
      const ar: ActiveWheelRound = {
        nonce: currentNonce,
        amount,
        risk: s0.risk,
        segments: s0.segments,
        liveBetId,
        placedAt: Date.now(),
      };
      wheelStore.set((s) => ({
        ...s,
        nonce: s.nonce + 1,
        pendingAmount: amount,
        activeRound: ar,
      }));
      setResultIndex(null);
      setResultMult(null);
      round.place();
      sfx.play("bet");
      // bet 토스트 제거 (Limbo 정렬).
    },
    [round, tryDebit, mode, sfx],
  );

  // PF seed 적용
  const applySeed = useCallback(() => {
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    const cur = wheelStore.get().clientSeed;
    if (next === cur) {
      setShowFair(false);
      return;
    }
    wheelStore.set((s) => ({
      ...s,
      clientSeed: next,
      nonce: 0,
      activeRound: null,
      lastOutcome: null,
    }));
    setResultIndex(null);
    setResultMult(null);
    settledRef.current = false;
    appToast.game.bet({ amount: "시드 변경됨 · nonce 0 리셋" });
    setShowFair(false);
  }, [seedDraft]);

  // Hotkeys
  const hotkeys = useMemo<HotkeyMap>(
    () => ({
      " ": (e) => {
        e.preventDefault();
        void handlePlace(wheelStore.get().pendingAmount);
      },
      ArrowLeft: (e) => {
        e.preventDefault();
        cycleRisk(-1);
      },
      ArrowRight: (e) => {
        e.preventDefault();
        cycleRisk(+1);
      },
      "1": () => setSegmentsValue(10),
      "2": () => setSegmentsValue(20),
      "3": () => setSegmentsValue(30),
      p: () => setShowFair(true),
      m: () => sfx.toggleMute(),
    }),
    [handlePlace, cycleRisk, setSegmentsValue, sfx],
  );
  useHotkeys(hotkeys);

  const avgMult = useMemo(() => expectedMultiplier(risk, segments), [risk, segments]);

  // PF rows
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
      label: "위험도 / 세그먼트",
      content: (
        <code className="font-numeric text-gold">
          {risk} / {segments}
        </code>
      ),
    },
    {
      label: "평균 배수 (엔진 RTP)",
      content: <code className="font-numeric text-emerald">{avgMult.toFixed(4)}x</code>,
    },
  ];

  const displayRisk = activeRound?.risk ?? risk;
  const displaySegments = activeRound?.segments ?? segments;

  return (
    <div className="flex flex-col gap-2">
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
              <h1 className="text-xl font-extrabold leading-tight">Wheel</h1>
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
        rulesCard={<GameRulesCard rules={WHEEL_RULES} onVerify={() => setShowFair(true)} />}
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
          <WheelDisplay
            risk={displayRisk}
            segments={displaySegments}
            phase={round.phase as "idle" | "rolling" | "settled"}
            resultIndex={resultIndex}
            resultMultiplier={resultMult}
            jackpotTrigger={jackpotTrigger}
          />
        }
        controls={
          <WheelControls
            risk={risk}
            segments={segments}
            disabled={!round.isIdle}
            onRisk={setRisk}
            onSegments={setSegmentsValue}
          />
        }
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={pendingAmount}
            targetMultiplier={Math.max(1.01, avgMult)}
          />
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            variant="full"
            showAutoTarget={false}
            canPlace={round.isIdle}
            hasActiveBet={!round.isIdle}
            bettingRoundKey={activeRound?.nonce ?? nonce}
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
            onPlace={(amount) => {
              wheelStore.set((s) => ({ ...s, pendingAmount: amount }));
              void handlePlace(amount);
            }}
            onCashout={() => {}}
          />
        }
      />

      <LiveBetsFeed game="wheel" limit={10} />

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
