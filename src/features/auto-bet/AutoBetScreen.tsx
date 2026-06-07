/**
 * GA-J — active server auto-bet sessions list.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Pause, Play, Square } from "lucide-react";
import {
  autoBetList,
  autoBetPause,
  autoBetResume,
  autoBetStop,
} from "@/lib/api/autoBetSession";
import type { AutoBetListItem } from "@/lib/api/autoBetSessionSchemas";
import { appToast } from "@/shared/ui/toast";

export function AutoBetScreen() {
  const [items, setItems] = useState<AutoBetListItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const rows = await autoBetList();
      setItems(rows);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 3000);
    return () => clearInterval(id);
  }, [refresh]);

  async function act(id: string, action: "pause" | "resume" | "stop") {
    try {
      if (action === "pause") await autoBetPause(id);
      else if (action === "resume") await autoBetResume(id);
      else await autoBetStop(id);
      await refresh();
    } catch {
      appToast.raw.error("작업에 실패했습니다");
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6">
      <header className="flex items-center gap-2">
        <Link
          to="/earn"
          className="glass-1 grid h-9 w-9 place-items-center rounded-full"
          aria-label="뒤로"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-extrabold">서버 자동 베팅</h1>
          <p className="text-xs text-(--color-muted)">탭을 닫아도 서버에서 계속 실행됩니다</p>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-(--color-muted)">불러오는 중…</p>
      ) : items.length === 0 ? (
        <div className="glass-2 rounded-2xl p-6 text-center text-sm text-(--color-muted)">
          활성 자동 베팅 세션이 없습니다. 게임 화면 Auto 탭에서 시작하세요.
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((row) => (
            <li key={row.id} className="glass-2 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="font-bold capitalize">{row.game}</span>
                <span className="rounded-full bg-(--color-surface-hi) px-2 py-0.5 text-[10px] font-bold uppercase">
                  {row.status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                <div>
                  <span className="text-(--color-muted)">라운드</span>
                  <p className="font-numeric font-bold">{row.bets_placed}</p>
                </div>
                <div>
                  <span className="text-(--color-muted)">PnL</span>
                  <p className={`font-numeric font-bold ${row.pnl >= 0 ? "text-emerald" : "text-(--color-rose)"}`}>
                    {row.pnl >= 0 ? "+" : ""}
                    {row.pnl}
                  </p>
                </div>
                <div>
                  <span className="text-(--color-muted)">다음 베팅</span>
                  <p className="font-numeric font-bold">{row.current_bet}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                {row.status === "running" ? (
                  <button
                    type="button"
                    onClick={() => void act(row.id, "pause")}
                    className="glass-1 flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold"
                  >
                    <Pause size={12} /> 일시정지
                  </button>
                ) : row.status === "paused" ? (
                  <button
                    type="button"
                    onClick={() => void act(row.id, "resume")}
                    className="glass-1 flex flex-1 items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold"
                  >
                    <Play size={12} /> 재개
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void act(row.id, "stop")}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-(--color-rose) py-2 text-xs font-bold text-(--color-bg-0)"
                >
                  <Square size={12} /> 정지
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
