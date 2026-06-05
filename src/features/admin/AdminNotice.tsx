/**
 * AdminNotice — Supabase admin_list_notices / admin_upsert_notice / admin_delete_notice.
 * TODO(real-money): 푸시 연동은 Edge Function + admin RPC 후속.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pin, Plus, Calendar, Trash2, Edit3 } from "lucide-react";
import { AdminLayout } from "@/shared/admin/AdminLayout";
import {
  adminDeleteNotice,
  adminListNotices,
  adminUpsertNotice,
  type AdminNoticeView,
} from "@/lib/api/admin/notices";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { NOTICES, type Notice } from "@/mocks/notice";
import { appToast } from "@/shared/ui/toast";

const ADMIN_NOTICES_KEY = ["admin", "notices"] as const;

function mockToAdmin(n: Notice): AdminNoticeView {
  return { ...n, isPublished: true };
}

export function AdminNotice() {
  const configured = isSupabaseConfigured();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ADMIN_NOTICES_KEY,
    queryFn: adminListNotices,
    enabled: configured,
  });

  const [localList, setLocalList] = useState<AdminNoticeView[]>(() => NOTICES.map(mockToAdmin));
  const list = configured && query.data ? query.data : localList;
  const [editing, setEditing] = useState<AdminNoticeView | null>(null);

  const upsertMut = useMutation({
    mutationFn: adminUpsertNotice,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ADMIN_NOTICES_KEY });
      await qc.invalidateQueries({ queryKey: ["notices"] });
      appToast.raw.success("공지 저장됨");
      setEditing(null);
    },
    onError: () => appToast.raw.error("공지 저장 실패"),
  });

  const deleteMut = useMutation({
    mutationFn: adminDeleteNotice,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ADMIN_NOTICES_KEY });
      await qc.invalidateQueries({ queryKey: ["notices"] });
      appToast.raw.success("공지 삭제됨");
    },
    onError: () => appToast.raw.error("공지 삭제 실패"),
  });

  const save = (n: AdminNoticeView) => {
    if (configured) {
      upsertMut.mutate({
        id: n.id,
        category: n.category,
        title: n.title,
        excerpt: n.excerpt,
        body: n.body,
        pinned: n.pinned,
        published_at: n.publishedAt,
        author: n.author,
        is_published: n.isPublished,
      });
      return;
    }
    setLocalList((prev) => {
      const i = prev.findIndex((p) => p.id === n.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = n;
        return next;
      }
      return [n, ...prev];
    });
    setEditing(null);
  };

  const remove = (id: string) => {
    if (configured) {
      deleteMut.mutate(id);
      return;
    }
    setLocalList((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <AdminLayout active="notice">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">공지 관리</h1>
          <p className="text-sm text-(--color-muted)">
            {configured ? "Supabase SSOT · 사용자 /notice 즉시 반영" : "오프라인 mock"}
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              id: `n-${Date.now()}`,
              category: "공지",
              title: "",
              excerpt: "",
              body: "",
              pinned: false,
              publishedAt: new Date().toISOString(),
              author: "운영팀",
              isPublished: true,
            })
          }
          className="flex items-center gap-1 rounded-2xl bg-holographic px-4 py-2 text-sm font-bold text-(--color-bg-0)"
        >
          <Plus size={14} /> 새 공지
        </button>
      </div>

      <div className="grid gap-2">
        {list.map((n) => (
          <div key={n.id} className="glass-2 flex items-center gap-3 rounded-2xl p-4">
            {n.pinned && <Pin size={14} className="text-gold" />}
            {!n.isPublished && (
              <span className="rounded-full bg-(--color-rose)/20 px-2 py-0.5 text-[9px] font-bold text-rose">
                비공개
              </span>
            )}
            <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold">
              {n.category}
            </span>
            <span className="flex-1 truncate text-sm font-semibold">
              {n.title || "(제목 없음)"}
            </span>
            <span className="font-numeric text-[11px] text-(--color-muted)">
              {n.publishedAt.slice(0, 10)}
            </span>
            <button onClick={() => setEditing(n)} className="rounded-lg p-1.5 hover:bg-white/8">
              <Edit3 size={14} />
            </button>
            <button
              onClick={() => remove(n.id)}
              className="rounded-lg p-1.5 text-(--color-rose) hover:bg-white/8"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-3 w-full max-w-lg rounded-3xl p-6 shadow-depth-3">
            <h2 className="mb-4 text-lg font-bold">
              {list.some((p) => p.id === editing.id) ? "공지 수정" : "새 공지"}
            </h2>
            <div className="flex flex-col gap-3">
              <select
                value={editing.category}
                onChange={(e) =>
                  setEditing({ ...editing, category: e.target.value as Notice["category"] })
                }
                className="glass-1 rounded-xl px-3 py-2 text-sm"
              >
                {["공지", "업데이트", "점검", "보안"].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                placeholder="제목"
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="glass-1 rounded-xl px-3 py-2 text-sm"
              />
              <input
                placeholder="요약"
                value={editing.excerpt}
                onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })}
                className="glass-1 rounded-xl px-3 py-2 text-sm"
              />
              <textarea
                placeholder="본문"
                value={editing.body}
                rows={6}
                onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                className="glass-1 rounded-xl px-3 py-2 text-sm"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.pinned}
                  onChange={(e) => setEditing({ ...editing, pinned: e.target.checked })}
                />
                상단 고정
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={editing.isPublished}
                  onChange={(e) => setEditing({ ...editing, isPublished: e.target.checked })}
                />
                사용자 앱에 게시
              </label>
              <label className="flex items-center gap-2 text-xs text-(--color-muted)">
                <Calendar size={12} /> 예약 발행
                <input
                  type="datetime-local"
                  value={editing.publishedAt.slice(0, 16)}
                  onChange={(e) =>
                    setEditing({ ...editing, publishedAt: new Date(e.target.value).toISOString() })
                  }
                  className="glass-1 ml-auto rounded-lg px-2 py-1 text-xs"
                />
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="glass-1 rounded-xl px-4 py-2 text-sm"
              >
                취소
              </button>
              <button
                onClick={() => save(editing)}
                disabled={upsertMut.isPending}
                className="rounded-xl bg-holographic px-4 py-2 text-sm font-bold text-(--color-bg-0)"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
