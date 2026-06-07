/**
 * MinesScreen — Stake-style 5×5 Mines.
 *
 * ROUND N "분리 & 폴리시"
 *  - 보드/툴팁/플립/shake/flash → MinesDisplay
 *  - 지뢰 수 stepper/preset/random/cashout/HUD → MinesControls
 *  - 라운드 lifecycle (place/reveal/cashout/random/복원/정리/SFX/RecentResult) → useMinesLifecycle
 *  - PF 모달 → shared ProvablyFairModal
 *  - history pill → shared HistoryPillStrip
 *  - SessionStatsBar / RoundResultCard / ShareResultButton / useHotkeys 적용
 *
 * 불변식 (ROUND H 보존)
 *  - minesStore.activeRound 영속 — 이탈·새로고침 시 동일 보드/revealed 복원 (Stake resume)
 *  - unmount refund 없음 — mid-round 이탈 시 라운드 유지
 *  - MinesEngine·StakeBetPanel·useGameWallet·useGameRound·minesStore 스키마 0-diff
 *
 * GA-complete: 지뢰 배치/정산은 서버 RPC — 클라이언트는 결과 표시만.
 */
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Bomb, ShieldCheck } from "lucide-react";
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
import { MINES_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { PF_BLOCK_ACTIVE_ROUND_MSG } from "@/shared/games/ui/pfPolicy";
import { usePfSession } from "@/shared/games/hooks/usePfSession";
import { TOTAL_TILES, clampMines, nextMultiplier } from "@/shared/games/mines/MinesEngine";
import { minesStore } from "@/shared/games/state/persistedGameState";
import { useGameWallet } from "@/shared/wallet/useGameWallet";
import { useHotkeys, type HotkeyMap } from "@/shared/hooks/useHotkeys";
import { DemoLowBanner } from "@/shared/wallet/DemoLowBanner";
import {
  MINES_RESULT_FLASH_DELAY_MS,
  notifyPfSeedChanged,
  useRoundResultFlash,
} from "@/shared/games/ui/gameOutcomePolicy";
import { appToast } from "@/shared/ui/toast";
import { formatPHON } from "@/lib/format";
import { useRegisterMainMode, useRegisterRightRail } from "@/shared/layout/useGameLayout";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { MinesDisplay } from "./MinesDisplay";
import { MinesControls } from "./MinesControls";
import { useMinesLifecycle, type RecentResult } from "./useMinesLifecycle";
import { MinesRightRail } from "./MinesRightRail";

const LEGACY_PF_SEED = "phonara-mines-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

function paintResultCanvas(
  recent: RecentResult,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
) {
  const w = canvas.width;
  const h = canvas.height;
  ctx.fillStyle = recent.outcome === "win" ? "oklch(0.78 0.18 90)" : "oklch(0.62 0.2 25)";
  ctx.font = "bold 28px system-ui";
  ctx.textAlign = "center";
  ctx.fillText(recent.outcome === "win" ? "MINES WIN" : "MINES LOSS", w / 2, 60);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 36px system-ui";
  ctx.fillText(`${recent.mult.toFixed(2)}x`, w / 2, h / 2 + 8);
  ctx.font = "16px system-ui";
  ctx.fillText(
    `#${recent.nonce}  ${recent.profit >= 0 ? "+" : ""}${recent.profit.toFixed(2)}  · 💎${recent.revealed}/💣${recent.mineCount}`,
    w / 2,
    h - 24,
  );
}

export function MinesScreen() {
  useRegisterMainMode("game");
  const isDesktop = useDesktopLayout();
  const rightRailNode = useMemo(() => <MinesRightRail />, []);
  useRegisterRightRail(rightRailNode);
  const wallet = useGameWallet();
  const { balance } = wallet;
  const nonce = minesStore.use((s) => s.nonce);
  const history = minesStore.use((s) => s.history);
  const lastOutcome = minesStore.use((s) => s.lastOutcome);
  const mineCount = minesStore.use((s) => s.mineCount);
  const pendingAmount = minesStore.use((s) => s.pendingAmount);
  const clientSeed = minesStore.use((s) => s.clientSeed);

  const round = useGameRound({ isMultiStep: true, settledMs: 1000 });
  const pf = usePfSession("mines", LEGACY_PF_SEED, DEFAULT_CLIENT_SEED, {
    clientSeed: clientSeed || DEFAULT_CLIENT_SEED,
  });
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const liveRegionId = useId();

  const life = useMinesLifecycle({
    round,
    wallet,
    nonce,
    mineCount,
    serverSeed: pf.serverSeed,
    pfReady: pf.ready,
    defaultClientSeed: DEFAULT_CLIENT_SEED,
  });
  const {
    active,
    revealed,
    hitTile,
    shakeKey,
    flashKey,
    recent,
    setRecent,
    currentMult,
    nextSafeChance,
    nextMultPreview,
    sfx,
    handlePlace,
    handleReveal,
    handleCashout,
    handleRandomPick,
    resetForSeedChange,
  } = life;
  const flashRecent = useRoundResultFlash(recent, MINES_RESULT_FLASH_DELAY_MS);

  const setMineCount = useCallback((n: number) => {
    minesStore.set((s) => ({ ...s, mineCount: clampMines(n) }));
  }, []);

  // Hotkeys: 1–0 / R / C / ESC / M
  const hotkeys = useMemo<HotkeyMap>(() => {
    const map: HotkeyMap = {
      c: (e) => {
        e.preventDefault();
        handleCashout();
      },
      r: (e) => {
        e.preventDefault();
        handleRandomPick();
      },
      Escape: () => setShowFair((v) => !v),
      m: () => sfx.toggleMute(),
    };
    for (let i = 1; i <= 9; i++) {
      map[String(i)] = (e) => {
        e.preventDefault();
        handleReveal(i - 1);
      };
    }
    map["0"] = (e) => {
      e.preventDefault();
      handleReveal(9);
    };
    return map;
  }, [handleReveal, handleCashout, handleRandomPick, sfx]);
  useHotkeys(hotkeys);

  const tiles = useMemo(() => Array.from({ length: TOTAL_TILES }, (_, i) => i), []);
  const safeRevealable = TOTAL_TILES - (active?.mineCount ?? mineCount);

  useEffect(() => {
    if (showFair) setSeedDraft(clientSeed);
  }, [showFair, clientSeed]);

  const applySeed = useCallback(() => {
    if (minesStore.get().activeRound || !round.isIdle) {
      appToast.raw.error(PF_BLOCK_ACTIVE_ROUND_MSG);
      return;
    }
    const next = seedDraft.trim().slice(0, 32) || DEFAULT_CLIENT_SEED;
    if (next === clientSeed) {
      setShowFair(false);
      return;
    }
    void pf.setClientSeed(next).then(() => {
      minesStore.set((s) => ({
        ...s,
        clientSeed: next,
        nonce: 0,
        lastOutcome: null,
      }));
      resetForSeedChange();
      notifyPfSeedChanged();
      setShowFair(false);
    }).catch(() => {
      appToast.raw.error("시드 변경에 실패했습니다");
    });
  }, [seedDraft, clientSeed, resetForSeedChange, round.isIdle, pf]);

  const fairRows: ProvablyFairRow[] = useMemo(
    () => [
      {
        label: "서버 시드 (해시)",
        content: (
          <code className="break-all text-[10px] text-(--color-cyan)">
            {pf.commitHash || "로딩 중..."}
          </code>
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
      { label: "다음 라운드 번호", content: <code className="font-numeric">{nonce}</code> },
      {
        label: "현재 지뢰 수",
        content: <code className="font-numeric text-(--color-rose)">{mineCount}</code>,
      },
    ],
    [pf.commitHash, seedDraft, nonce, mineCount],
  );

  const announce = useMemo(() => {
    if (hitTile != null) return `지뢰 폭발. 배수 0. 손실 ${formatPHON(active?.amount ?? 0)}.`;
    if (revealed.length === 0) return "베팅 대기 중.";
    return `안전 ${revealed.length}/${safeRevealable}. 현재 배수 ${currentMult.toFixed(2)}배.`;
  }, [hitTile, revealed.length, safeRevealable, currentMult, active]);

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
              <h1 className="text-xl font-extrabold leading-tight">Mines</h1>
              <ModeBadge className="mt-0.5" />
            </div>
            <span className="glass-1 ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold text-(--color-muted) font-numeric">
              #{nonce.toString().padStart(4, "0")}
            </span>
            <button
              type="button"
              onClick={() => setShowFair(true)}
              className="glass-1 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
            >
              <ShieldCheck size={12} className="text-emerald" />
              공정성
            </button>
          </header>
        }
        rulesCard={<GameRulesCard rules={MINES_RULES} onVerify={() => setShowFair(true)} />}
        historyStrip={
          <div className="flex flex-col gap-1.5">
            <HistoryPillStrip
              items={history.map((h) => ({ id: h.id, multiplier: h.multiplier, won: h.win }))}
              onPillClick={() => setShowFair(true)}
            />
            <SessionStatsBar />
          </div>
        }
        displayArea={
          <div className="glass-2 rounded-2xl p-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px]">
              <span className="font-bold text-(--color-muted)">
                지뢰{" "}
                <span className="font-numeric text-(--color-rose)">
                  {active?.mineCount ?? mineCount}
                </span>
                {" · "}
                보석{" "}
                <span className="font-numeric text-emerald">
                  {revealed.length}/{safeRevealable}
                </span>
                {" · "}
                다음 승률{" "}
                <span className="font-numeric text-(--color-cyan)">
                  {(nextSafeChance * 100).toFixed(1)}%
                </span>
              </span>
              <span className="font-numeric font-extrabold text-gold">
                {currentMult.toFixed(2)}x
              </span>
            </div>
            <MinesDisplay
              tiles={tiles}
              revealed={revealed}
              active={active}
              hitTile={hitTile}
              shakeKey={shakeKey}
              flashKey={flashKey}
              phase={round.phase}
              nextMultPreview={nextMultPreview}
              onReveal={handleReveal}
            />
            <span id={liveRegionId} aria-live="polite" className="sr-only">
              {announce}
            </span>
          </div>
        }
        controls={
          <MinesControls
            mineCount={mineCount}
            onMineCountChange={setMineCount}
            isIdle={round.isIdle}
            isPlaying={round.phase === "playing"}
            canCashout={revealed.length > 0 && hitTile == null}
            currentMult={currentMult}
            onCashout={handleCashout}
            onRandomPick={handleRandomPick}
          />
        }
        summaryPanel={
          <BetSummaryPanel
            variant="static"
            amount={active?.amount ?? pendingAmount}
            targetMultiplier={
              round.phase === "playing" && active ? currentMult : nextMultiplier(1, mineCount)
            }
          />
        }
        banner={<DemoLowBanner />}
        betPanel={
          <StakeBetPanel
            canPlace={round.isIdle && pf.ready}
            hasActiveBet={round.phase === "playing"}
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
            bettingRoundKey={active?.nonce ?? nonce}
            variant="compact"
            showAutoTarget={false}
            suppressCashoutButton
            defaultAmount={pendingAmount}
            onAmountChange={(amount) => minesStore.set((s) => ({ ...s, pendingAmount: amount }))}
            onPlace={(amount) => handlePlace(amount)}
            onCashout={handleCashout}
            serverAutoBet={{
              game: "mines",
              getBetParams: () => ({
                mine_count: minesStore.get().mineCount,
                reveal_count: 1,
              }),
            }}
          />
        }
      />

      {!isDesktop && <LiveBetsFeed game="mines" limit={10} />}

      {flashRecent && (
        <>
          <RoundResultCard
            outcome={flashRecent.outcome}
            profit={flashRecent.profit}
            multiplier={flashRecent.mult}
            nonce={flashRecent.nonce}
            onDone={() => setRecent(null)}
          />
          <div className="pointer-events-auto absolute right-4 top-[calc(33%+4.5rem)] z-20">
            <ShareResultButton
              renderToCanvas={(canvas, ctx) => paintResultCanvas(flashRecent, canvas, ctx)}
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
            <span className="flex items-start gap-1">
              <Bomb size={10} className="mt-0.5 shrink-0" />
              시드 변경은 라운드 종료 후 가능. 이탈 시 진행 상태가 저장되어 돌아오면 이어서
              플레이합니다.
            </span>
            <PfVerifyPageLink
              game="mines"
              serverSeed={pf.serverSeed}
              serverSeedHash={pf.commitHash}
              clientSeed={seedDraft.trim() || clientSeed || DEFAULT_CLIENT_SEED}
              nonce={nonce}
              mineCount={mineCount}
            />
          </>
        }
      />
    </div>
  );
}
