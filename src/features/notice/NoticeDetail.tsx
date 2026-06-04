import { Link } from "@tanstack/react-router";
import { ArrowLeft, Paperclip, Share2, Pin } from "lucide-react";
import { getNoticeById } from "@/mocks/notice";

function fmtFull(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function NoticeDetail({ id }: { id: string }) {
  const n = getNoticeById(id);
  if (!n) {
    return (
      <div className="glass-2 rounded-2xl p-8 text-center text-sm text-[var(--color-muted)]">
        공지를 찾을 수 없습니다.
        <div className="mt-3">
          <Link to="/notice" className="text-[var(--color-cyan)]">목록으로</Link>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <Link to="/notice" className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
        <ArrowLeft size={16} /> 공지사항
      </Link>
      <article className="glass-3 flex flex-col gap-3 rounded-3xl p-5 shadow-depth-2">
        <div className="flex items-center gap-2">
          {n.pinned && <Pin size={12} className="text-[var(--color-gold)]" />}
          <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold">{n.category}</span>
          <span className="ml-auto font-numeric text-[11px] text-[var(--color-muted)]">{fmtFull(n.publishedAt)}</span>
        </div>
        <h1 className="text-xl font-extrabold leading-snug">{n.title}</h1>
        <div className="text-xs text-[var(--color-muted-2)]">작성: {n.author}</div>
        <div className="my-2 h-px bg-[var(--color-border)]" />
        <div className="whitespace-pre-wrap text-sm leading-relaxed">{n.body}</div>

        {n.attachments && n.attachments.length > 0 && (
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="text-xs text-[var(--color-muted)]">첨부파일</div>
            {n.attachments.map((a) => (
              <div key={a.name} className="glass-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs">
                <Paperclip size={12} />
                <span className="flex-1 truncate">{a.name}</span>
                <span className="text-[var(--color-muted)]">{a.size}</span>
              </div>
            ))}
          </div>
        )}

        <button className="glass-2 mt-3 flex h-10 items-center justify-center gap-2 rounded-2xl text-sm font-semibold">
          <Share2 size={14} /> 공유하기
        </button>
      </article>
    </div>
  );
}
