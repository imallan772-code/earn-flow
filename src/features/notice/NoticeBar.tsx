import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, ChevronRight, Pin } from "lucide-react";
import { NOTICES } from "@/mocks/notice";

export function NoticeBar() {
  const list = NOTICES.filter((n) => n.pinned).slice(0, 3);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % list.length), 4000);
    return () => clearInterval(id);
  }, [list.length]);
  if (list.length === 0) return null;
  const n = list[i];
  return (
    <Link
      to="/notice/$id"
      params={{ id: n.id }}
      className="glass-2 flex h-11 items-center gap-2 overflow-hidden rounded-2xl px-3"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-holographic">
        <Bell size={11} className="text-(--color-bg-0)" />
      </span>
      <Pin size={10} className="shrink-0 text-gold" />
      <span className="flex-1 truncate text-xs font-semibold">{n.title}</span>
      <ChevronRight size={14} className="shrink-0 text-(--color-muted)" />
    </Link>
  );
}
