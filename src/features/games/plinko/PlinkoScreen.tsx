/**
 * PlinkoScreen — page-level composition: header, rules, board, live feed.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck, X } from "lucide-react";
import { useMode } from "@/shared/mode/ModeContext";
import { ModeBadge } from "@/shared/mode/ModeToggle";
import { PlinkoBoard } from "@/shared/games/plinko/PlinkoBoard";
import { GameRulesCard } from "@/shared/games/ui/GameRulesCard";
import { PLINKO_RULES } from "@/shared/games/rules/gameRules";
import { LiveBetsFeed } from "@/shared/livefeed/LiveBetsFeed";

export function PlinkoScreen() {
  const { mode } = useMode();
  const [showFair, setShowFair] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center gap-2">
        <Link
          to="/games"
          className="glass-1 grid h-9 w-9 place-items-center rounded-full"
          aria-label="뒤로"
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold leading-tight">Plinko</h1>
          <ModeBadge className="mt-0.5" />
        </div>
        <button
          onClick={() => setShowFair(true)}
          className="glass-1 ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold"
        >
          <ShieldCheck size={12} className="text-[var(--color-emerald)]" />
          공정성
        </button>
      </header>

      <GameRulesCard rules={PLINKO_RULES} onVerify={() => setShowFair(true)} />

      <PlinkoBoard mode={mode} />

      <LiveBetsFeed game="plinko" limit={10} />

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
              <button onClick={() => setShowFair(false)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs leading-relaxed text-[var(--color-muted)]">
              매 라운드 시드 ={" "}
              <code className="text-[var(--color-cyan)]">phonara-plinko-{`{nonce}`}</code>. 이
              시드를 HMAC-SHA256으로 해시하여 각 줄(row)에서의 좌/우 튕김 방향을 비트 단위로
              추출합니다. 결과 슬롯은 시드만으로 사전에 결정되어 있어 누구나 동일한 시드로
              재현·검증할 수 있습니다.
            </p>
            <p className="mt-3 text-[10px] leading-relaxed text-[var(--color-muted-2)]">
              ※ 정식 출시 시 server seed commit/reveal 방식으로 전환 예정.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
