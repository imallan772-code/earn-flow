/**
 * PlinkoScreen — page-level composition: header, rules, board, live feed.
 * GA-I: ProvablyFairModal with HMAC path when plinko_server_settle flag on.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useMode } from "@/shared/mode/ModeContext";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { PlinkoBoard } from "@/shared/games/plinko/PlinkoBoard";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { PLINKO_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";
import { useRegisterMainMode, useRegisterRightRail } from "@/shared/layout/useGameLayout";
import { useDesktopLayout } from "@/shared/hooks/useDesktopLayout";
import { ProvablyFairModal, type ProvablyFairRow } from "@/shared/games/ui/ProvablyFairModal";
import { PfVerifyPageLink } from "@/shared/games/ui/PfVerifyPageLink";
import { usePfSession } from "@/shared/games/hooks/usePfSession";
import { useGameAuthorityFlag } from "@/shared/games/hooks/useGameAuthorityFlag";
import { plinkoStore } from "@/shared/games/state/persistedGameState";
import { notifyPfSeedChanged } from "@/shared/games/ui/gameOutcomePolicy";
import { appToast } from "@/shared/ui/toast";
import { PlinkoRightRail } from "./PlinkoRightRail";

const LEGACY_PF_SEED = "phonara-plinko-demo-server-seed-v1";
const DEFAULT_CLIENT_SEED = "phonara-player-001";

export function PlinkoScreen() {
  useRegisterMainMode("game");
  const { mode } = useMode();
  const [showFair, setShowFair] = useState(false);
  const [seedDraft, setSeedDraft] = useState("");
  const isDesktop = useDesktopLayout();
  const rightRailNode = useMemo(() => <PlinkoRightRail />, []);
  useRegisterRightRail(rightRailNode);

  const nonce = plinkoStore.use((s) => s.nonce);
  const rows = plinkoStore.use((s) => s.rows);
  const risk = plinkoStore.use((s) => s.risk);
  const pf = usePfSession("plinko", LEGACY_PF_SEED, DEFAULT_CLIENT_SEED);
  const plinkoServerFlag = useGameAuthorityFlag("plinko_server_settle");

  useEffect(() => {
    if (showFair) setSeedDraft(pf.clientSeed || DEFAULT_CLIENT_SEED);
  }, [showFair, pf.clientSeed]);

  const applySeed = useCallback(() => {
    const trimmed = seedDraft.trim();
    if (!trimmed) return;
    void pf.setClientSeed(trimmed).then(() => {
      plinkoStore.set((s) => ({ ...s, nonce: 0 }));
      notifyPfSeedChanged();
      setShowFair(false);
    }).catch(() => {
      appToast.raw.error("시드 변경에 실패했습니다");
    });
  }, [seedDraft, pf]);

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
    { label: "다음 라운드 번호", content: <code className="font-numeric">{nonce}</code> },
    {
      label: "행 / 위험도",
      content: (
        <code className="font-numeric text-gold">
          {rows}행 / {risk}
        </code>
      ),
    },
  ];

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
          <h1 className="text-xl font-extrabold leading-tight">Plinko</h1>
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

      <GameRulesCard rules={PLINKO_RULES} onVerify={() => setShowFair(true)} />

      <PlinkoBoard mode={mode} />

      {!isDesktop && <LiveBetsFeed game="plinko" limit={10} />}

      <ProvablyFairModal
        open={showFair}
        onClose={() => setShowFair(false)}
        rows={fairRows}
        onApply={applySeed}
        footer={
          <>
            {plinkoServerFlag && pf.ready && !pf.legacyFallback ? (
              <p>
                GA-I 서버 권위: HMAC-SHA256 + pf_draw_float로 행별 경로(0/1)를 결정합니다. real
                모드에서 클라이언트 RNG는 사용하지 않습니다.
              </p>
            ) : (
              <p className="text-warning">
                오프라인/레거시: mulberry32 결정론 엔진. 서버 PF 세션이 준비되면 HMAC 경로로
                전환됩니다.
              </p>
            )}
            <p>시드 변경 시 nonce 0 리셋. 대기 중인 공은 이탈 후에도 서버 큐에서 재개됩니다.</p>
            <PfVerifyPageLink
              game="plinko"
              serverSeed={pf.serverSeed}
              serverSeedHash={pf.commitHash}
              clientSeed={pf.clientSeed}
              nonce={nonce}
              risk={risk}
              rows={rows}
            />
          </>
        }
      />
    </div>
  );
}
