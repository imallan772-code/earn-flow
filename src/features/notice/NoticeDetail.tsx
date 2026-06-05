import { Link } from "@tanstack/react-router";
import { ArrowLeft, Share2, Pin } from "lucide-react";
import { useNoticeDetail } from "@/shared/notices/useNotices";

function fmtFull(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NoticeDetail({ id }: { id: string }) {
  const { notice: n, isLoading } = useNoticeDetail(id);
  if (isLoading) {
    return (
      <div className="glass-2 rounded-2xl p-8 text-center text-sm text-(--color-muted)">
        불러오는 중...
      </div>
    );
  }
  if (!n) {
    return (
      <div className="glass-2 rounded-2xl p-8 text-center text-sm text-(--color-muted)">
        공지를 찾을 수 없습니다.
        <div className="mt-3">
          <Link to="/notice" className="text-(--color-cyan)">
            목록으로
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Link to="/notice" className="flex items-center gap-1 text-sm text-(--color-muted)">
        <ArrowLeft size={16} /> 공지사항
      </Link>
      <article className="glass-3 flex flex-col gap-3 rounded-3xl p-5 shadow-depth-2">
        <div className="flex items-center gap-2">
          {n.pinned && <Pin size={12} className="text-gold" />}
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold">
            {n.category}
          </span>
          <span className="ml-auto font-numeric text-[11px] text-(--color-muted)">
            {fmtFull(n.publishedAt)}
          </span>
        </div>
        <h1 className="text-xl font-extrabold leading-snug">{n.title}</h1>
        <div className="text-xs text-muted-2">작성: {n.author}</div>
        <div className="my-2 h-px bg-(--color-border)" />
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</div>

        <button className="glass-2 mt-3 flex h-10 items-center justify-center gap-2 rounded-2xl text-sm font-semibold">
          <Share2 size={14} /> 공유하기
        </button>
      </article>
    </div>
  );
}
