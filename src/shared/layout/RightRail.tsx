/**
 * RightRail — 데스크탑 우측 패널. 등록된 콘텐츠 있을 때만 표시 (빈 320px 컬럼 방지).
 */
import { useGameLayout } from "./useGameLayout";

export function RightRail() {
  const { rightRail } = useGameLayout();
  if (!rightRail) return null;

  return (
    <aside
      className="glass-1 sticky top-0 hidden h-dvh max-h-dvh w-(--rightrail-width) shrink-0 flex-col overflow-y-auto border-l border-(--color-border) scrollbar-none lg:flex safe-top safe-bottom"
      aria-label="보조 패널"
    >
      <div className="flex flex-col gap-3 p-4">{rightRail}</div>
    </aside>
  );
}
