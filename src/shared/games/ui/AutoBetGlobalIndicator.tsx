/**
 * GA-J — global banner when server auto-bet sessions are active.
 */
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { autoBetList } from "@/lib/api/autoBetSession";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { useAuth } from "@/features/auth/AuthContext";
import { useGameAuthorityFlag } from "@/shared/games/hooks/useGameAuthorityFlag";

export function AutoBetGlobalIndicator() {
  const { status } = useAuth();
  const enabled = useGameAuthorityFlag("auto_bet_server");
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured() || status !== "authenticated") {
      setCount(0);
      return;
    }
    let alive = true;
    const poll = async () => {
      try {
        const items = await autoBetList();
        if (alive) setCount(items.filter((i) => i.status === "running").length);
      } catch {
        if (alive) setCount(0);
      }
    };
    void poll();
    const id = setInterval(() => void poll(), 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled, status]);

  if (count <= 0) return null;

  return (
    <Link
      to="/auto-bet"
      className="glass-1 flex items-center justify-center gap-2 border-b border-(--color-cyan)/30 bg-(--color-cyan)/10 px-4 py-2 text-center text-[11px] font-semibold text-(--color-cyan)"
    >
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-(--color-cyan)" />
      서버 자동 베팅 {count}개 실행 중 — 탭을 닫아도 계속됩니다
    </Link>
  );
}
