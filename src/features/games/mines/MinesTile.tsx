/**
 * MinesTile — 단일 타일. 3D flip + gem/bomb 애니메이션.
 *
 * 설계
 *  - React.memo(props는 boolean/number만 — 참조 평면화). 25타일 grid에서 부모 재렌더 시
 *    상태가 바뀐 타일만 다시 그린다.
 *  - LazyMotion + domAnimation (root에 이미 마운트됨)을 가정. `m.button` 사용.
 *  - `useReducedMotion()` → transform 비활성, opacity만.
 *  - hover/focus 시 onHoverPreview(tileIndex|null) 호출 → 부모가 단일 툴팁 1개를 좌표로 이동.
 *  - 키보드: 화면 단에서 1–0 → onReveal(0..9) 호출. 본 컴포넌트는 클릭 핸들러만 가짐.
 */
import { memo } from "react";
import { m, useReducedMotion } from "framer-motion";
import { Bomb, Gem } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  index: number;
  isRevealed: boolean;
  isHit: boolean;
  isMineRevealed: boolean;
  playing: boolean;
  onReveal: (index: number) => void;
  onHoverPreview?: (index: number | null) => void;
}

function MinesTileBase({
  index,
  isRevealed,
  isHit,
  isMineRevealed,
  playing,
  onReveal,
  onHoverPreview,
}: Props) {
  const reduced = useReducedMotion();
  const showFront = !isRevealed && !isHit && !isMineRevealed;
  const disabled = !playing || isRevealed || isHit;
  // flip back when revealed/hit/mineRevealed
  const flipped = isRevealed || isHit || isMineRevealed;

  const labelState = isRevealed
    ? "보석"
    : isHit
      ? "지뢰 적중"
      : isMineRevealed
        ? "지뢰 (공개)"
        : "미공개";

  return (
    <m.button
      type="button"
      aria-label={`타일 ${index + 1}, ${labelState}`}
      onClick={() => onReveal(index)}
      onMouseEnter={() => onHoverPreview?.(index)}
      onMouseLeave={() => onHoverPreview?.(null)}
      onFocus={() => onHoverPreview?.(index)}
      onBlur={() => onHoverPreview?.(null)}
      disabled={disabled}
      whileHover={!disabled && !reduced ? { y: -2, scale: 1.03 } : undefined}
      whileTap={!disabled && !reduced ? { scale: 0.94 } : undefined}
      animate={
        reduced
          ? { opacity: flipped ? 1 : 0.9 }
          : {
              rotateY: flipped ? 180 : 0,
              scale: isHit ? [1, 1.18, 1] : 1,
            }
      }
      transition={
        reduced
          ? { duration: 0.12 }
          : {
              rotateY: { type: "spring", stiffness: 220, damping: 18 },
              scale: { duration: isHit ? 0.36 : 0.18 },
            }
      }
      style={
        reduced
          ? undefined
          : { transformStyle: "preserve-3d", willChange: playing ? "transform" : undefined }
      }
      className={cn(
        "relative aspect-square rounded-lg text-xs font-extrabold outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1 focus-visible:ring-offset-(--color-bg-0)",
        showFront && "bg-(--color-surface-hi) text-(--color-muted) hover:bg-bg-2",
        isRevealed &&
          "bg-[color-mix(in_oklab,var(--color-emerald)_25%,transparent)] text-emerald shadow-[0_0_10px_-2px_color-mix(in_oklab,var(--color-emerald)_45%,transparent)]",
        isHit &&
          "bg-[color-mix(in_oklab,var(--color-rose)_40%,transparent)] text-(--color-rose) shadow-[0_0_14px_-2px_color-mix(in_oklab,var(--color-rose)_60%,transparent)]",
        !isRevealed &&
          !isHit &&
          isMineRevealed &&
          "bg-[color-mix(in_oklab,var(--color-rose)_18%,transparent)] text-(--color-rose) opacity-70",
      )}
    >
      <span
        className="grid h-full w-full place-items-center"
        style={reduced ? undefined : { transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
      >
        {isRevealed ? (
          <Gem size={16} aria-hidden />
        ) : isHit || isMineRevealed ? (
          <Bomb size={16} aria-hidden />
        ) : null}
      </span>
    </m.button>
  );
}

export const MinesTile = memo(MinesTileBase);
