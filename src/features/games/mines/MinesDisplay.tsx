/**
 * MinesDisplay — 5×5 보드 + bomb shake / rose flash / hover multiplier tooltip.
 *
 * 디자인 결정
 *  - 보드 grid + MinesTile 매핑은 본 컴포넌트가 SSOT. 부모는 상태(revealed/active/hit)만 전달.
 *  - 단일 absolute 툴팁 1개를 hover idx 좌표로 이동 (ROUND H 패턴 유지).
 *  - bomb hit shake: `shakeKey` 변경 시 1회 wiggle. reduced-motion 시 off.
 *  - rose flash: `flashKey` 변경 시 0.24s fade out 오버레이.
 *  - 미공개 지뢰 stagger reveal: round.phase === settled or (idle && hit) 일 때 `showAll`.
 *
 * 비대상
 *  - Engine 호출 (multi formula), wallet, store mutation — 부모(MinesScreen)에 둠.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { m, useReducedMotion } from "framer-motion";
import { MinesTile } from "./MinesTile";

interface Active {
  mines: number[];
  mineCount: number;
}

interface Props {
  tiles: readonly number[];
  revealed: readonly number[];
  active: Active | null;
  hitTile: number | null;
  shakeKey: number;
  flashKey: number;
  phase: "idle" | "playing" | "settled" | (string & {});
  /** 다음 픽 시 도달할 배수 (호버 툴팁용) */
  nextMultPreview: number;
  onReveal: (index: number) => void;
}

export function MinesDisplay({
  tiles,
  revealed,
  active,
  hitTile,
  shakeKey,
  flashKey,
  phase,
  nextMultPreview,
  onReveal,
}: Props) {
  const reduced = useReducedMotion();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const [hoverTile, setHoverTile] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);

  const onTileHover = useCallback((idx: number | null) => {
    setHoverTile(idx);
    if (idx == null) {
      setTipPos(null);
      return;
    }
    const board = boardRef.current;
    if (!board) return;
    const cell = board.querySelector<HTMLElement>(`[data-tile="${idx}"]`);
    if (!cell) return;
    const cr = cell.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    setTipPos({ x: cr.left - br.left + cr.width / 2, y: cr.top - br.top });
  }, []);

  // hover가 reveal로 사라지면 정리
  useEffect(() => {
    if (hoverTile != null && revealed.includes(hoverTile)) {
      setHoverTile(null);
      setTipPos(null);
    }
  }, [hoverTile, revealed]);

  const showAll = phase === "settled" || (phase === "idle" && hitTile != null);

  return (
    <m.div
      key={shakeKey}
      ref={boardRef}
      animate={shakeKey && !reduced ? { x: [0, -4, 4, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.16 }}
      className="relative"
    >
      <div className="grid grid-cols-5 gap-1.5" role="grid" aria-label="Mines 보드 5x5">
        {tiles.map((tile) => {
          const isRevealed = revealed.includes(tile);
          const isHit = hitTile === tile;
          const isMineRevealed = showAll && active != null && active.mines.includes(tile) && !isHit;
          return (
            <div key={tile} data-tile={tile} className="contents">
              <MinesTile
                index={tile}
                isRevealed={isRevealed}
                isHit={isHit}
                isMineRevealed={isMineRevealed}
                playing={phase === "playing" && hitTile == null}
                onReveal={onReveal}
                onHoverPreview={onTileHover}
              />
            </div>
          );
        })}
      </div>

      {/* Rose flash on bomb hit */}
      {flashKey > 0 && !reduced && (
        <m.div
          key={flashKey}
          initial={{ opacity: 0.4 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 0.24 }}
          className="pointer-events-none absolute inset-0 rounded-xl bg-[color-mix(in_oklab,var(--color-rose)_60%,transparent)]"
        />
      )}

      {/* Hover multiplier tooltip — single floating element */}
      {hoverTile != null &&
        tipPos != null &&
        phase === "playing" &&
        !revealed.includes(hoverTile) &&
        hitTile == null && (
          <div
            className="font-numeric pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg bg-(--color-bg-0)/90 px-2 py-1 text-[10px] font-extrabold text-gold shadow-glow-gold ring-1 ring-gold/30"
            style={{ left: tipPos.x, top: tipPos.y - 6 }}
          >
            +{nextMultPreview.toFixed(2)}x
          </div>
        )}
    </m.div>
  );
}
