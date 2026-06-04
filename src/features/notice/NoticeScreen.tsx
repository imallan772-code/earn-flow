import { Link } from "@tanstack/react-router";
import { Pin, Search, Bell, ShieldAlert, Wrench, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { NOTICES, type Notice, type NoticeCategory } from "@/mocks/notice";
import { cn } from "@/lib/utils";

const CATEGORIES: { key: NoticeCategory | "전체"; Icon: typeof Bell }[] = [
  { key: "전체", Icon: Bell },
  { key: "공지", Icon: Sparkles },
  { key: "업데이트", Icon: Sparkles },
  { key: "점검", Icon: Wrench },
  { key: "보안", Icon: ShieldAlert },
];

function categoryColor(c: NoticeCategory) {
  switch (c) {
    case "공지": return "var(--color-cyan)";
    case "업데이트": return "var(--color-purple)";
    case "점검": return "var(--color-warning)";
    case "보안": return "var(--color-rose)";
  }
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function NoticeScreen() {
  const [cat, setCat] = useState<NoticeCategory | "전체">("전체");
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const filtered = NOTICES.filter((n) => {
      const catOk = cat === "전체" || n.category === cat;
      const qOk = !q || n.title.includes(q) || n.excerpt.includes(q);
      return catOk && qOk;
    });
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.publishedAt.localeCompare(a.publishedAt);
    });
  }, [cat, q]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">공지사항</h1>
          <p className="text-sm text-[var(--color-muted)]">중요한 업데이트와 운영 소식</p>
        </div>
        <label className="glass-2 flex h-11 items-center gap-2 rounded-2xl px-3">
          <Search size={16} className="text-[var(--color-muted)]" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="공지 검색"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-muted-2)]"
          />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {CATEGORIES.map((c) => {
            const active = cat === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "bg-holographic text-[var(--color-bg-0)] shadow-glow-purple"
                    : "glass-1 text-[var(--color-muted)]"
                )}
              >
                <c.Icon size={12} />
                {c.key}
              </button>
            );
          })}
        </div>
      </header>

      <ul className="flex flex-col gap-2">
        {list.map((n) => (
          <NoticeRow key={n.id} n={n} />
        ))}
        {list.length === 0 && (
          <li className="glass-1 rounded-2xl p-8 text-center text-sm text-[var(--color-muted)]">
            조건에 맞는 공지가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}

function NoticeRow({ n }: { n: Notice }) {
  return (
    <Link
      to="/notice/$id"
      params={{ id: n.id }}
      className="glass-2 group flex flex-col gap-1.5 rounded-2xl p-4 transition active:scale-[0.99]"
    >
      <div className="flex items-center gap-2">
        {n.pinned && <Pin size={12} className="text-[var(--color-gold)]" />}
        <span
          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: `color-mix(in oklab, ${categoryColor(n.category)} 18%, transparent)`,
            color: categoryColor(n.category),
          }}
        >
          {n.category}
        </span>
        <span className="ml-auto font-numeric text-[11px] text-[var(--color-muted)]">{fmtDate(n.publishedAt)}</span>
      </div>
      <h3 className="text-[15px] font-bold leading-snug">{n.title}</h3>
      <p className="line-clamp-1 text-xs text-[var(--color-muted)]">{n.excerpt}</p>
    </Link>
  );
}
