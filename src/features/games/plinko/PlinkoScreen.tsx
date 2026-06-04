/**
 * PlinkoScreen — thin route wrapper. Reads mode from context, delegates to PlinkoBoard.
 */
import { useMode } from "@/shared/mode/ModeContext";
import { PlinkoBoard } from "@/shared/games/plinko/PlinkoBoard";

export function PlinkoScreen() {
  const { mode } = useMode();
  return <PlinkoBoard mode={mode} />;
}
