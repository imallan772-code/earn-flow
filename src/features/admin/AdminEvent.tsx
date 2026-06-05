import { useState } from "react";
import { Plus, Trash2, Edit3, Trophy } from "lucide-react";
import { EVENTS, type AppEvent } from "@/mocks/event";

export function AdminEvent() {
  const [list, setList] = useState<AppEvent[]>(EVENTS);
  const [editing, setEditing] = useState<AppEvent | null>(null);

  const save = (e: AppEvent) => {
    setList((prev) => {
      const i = prev.findIndex((p) => p.id === e.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = e;
        return next;
      }
      return [e, ...prev];
    });
    setEditing(null);
  };

  return (
    <div className="min-h-dvh bg-cosmic p-6 text-[var(--color-foreground)]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">이벤트 관리</h1>
          <p className="text-sm text-[var(--color-muted)]">
            진행중 · 예정 · 종료 · 카운트다운 · 리더보드 (mock)
          </p>
        </div>
        <button
          onClick={() =>
            setEditing({
              id: `e-${Date.now()}`,
              status: "예정",
              title: "",
              tagline: "",
              body: "",
              rewardPreview: "",
              startsAt: new Date().toISOString(),
              endsAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
              progress: 0,
              participants: 0,
              ctaLabel: "참여하기",
              terms: [],
              bgFrom: "var(--color-purple)",
              bgTo: "var(--color-pink)",
            })
          }
          className="flex items-center gap-1 rounded-2xl bg-holographic px-4 py-2 text-sm font-bold text-[var(--color-bg-0)]"
        >
          <Plus size={14} /> 새 이벤트
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((e) => (
          <div key={e.id} className="glass-2 flex flex-col gap-2 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold">
                {e.status}
              </span>
              <span className="ml-auto font-numeric text-[11px] text-[var(--color-muted)]">
                {e.startsAt.slice(0, 10)} ~ {e.endsAt.slice(0, 10)}
              </span>
            </div>
            <div className="text-sm font-bold">{e.title}</div>
            <div className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              <Trophy size={11} className="text-[var(--color-gold)]" />
              {e.rewardPreview}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-numeric text-xs text-[var(--color-muted)]">
                참여 {e.participants.toLocaleString()}
              </span>
              <div className="flex gap-1">
                <button onClick={() => setEditing(e)} className="rounded-lg p-1.5 hover:bg-white/8">
                  <Edit3 size={14} />
                </button>
                <button
                  onClick={() => setList((prev) => prev.filter((p) => p.id !== e.id))}
                  className="rounded-lg p-1.5 text-[var(--color-rose)] hover:bg-white/8"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="glass-3 w-full max-w-lg rounded-3xl p-6 shadow-depth-3">
            <h2 className="mb-4 text-lg font-bold">이벤트 편집</h2>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={editing.status}
                onChange={(ev) =>
                  setEditing({ ...editing, status: ev.target.value as AppEvent["status"] })
                }
                className="glass-1 col-span-2 rounded-xl px-3 py-2 text-sm"
              >
                {["진행중", "예정", "종료"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                placeholder="제목"
                value={editing.title}
                onChange={(ev) => setEditing({ ...editing, title: ev.target.value })}
                className="glass-1 col-span-2 rounded-xl px-3 py-2 text-sm"
              />
              <input
                placeholder="태그라인"
                value={editing.tagline}
                onChange={(ev) => setEditing({ ...editing, tagline: ev.target.value })}
                className="glass-1 col-span-2 rounded-xl px-3 py-2 text-sm"
              />
              <input
                placeholder="보상 미리보기"
                value={editing.rewardPreview}
                onChange={(ev) => setEditing({ ...editing, rewardPreview: ev.target.value })}
                className="glass-1 col-span-2 rounded-xl px-3 py-2 text-sm"
              />
              <textarea
                placeholder="본문"
                rows={4}
                value={editing.body}
                onChange={(ev) => setEditing({ ...editing, body: ev.target.value })}
                className="glass-1 col-span-2 rounded-xl px-3 py-2 text-sm"
              />
              <label className="text-xs">
                시작
                <input
                  type="datetime-local"
                  value={editing.startsAt.slice(0, 16)}
                  onChange={(ev) =>
                    setEditing({ ...editing, startsAt: new Date(ev.target.value).toISOString() })
                  }
                  className="glass-1 mt-1 w-full rounded-lg px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs">
                종료
                <input
                  type="datetime-local"
                  value={editing.endsAt.slice(0, 16)}
                  onChange={(ev) =>
                    setEditing({ ...editing, endsAt: new Date(ev.target.value).toISOString() })
                  }
                  className="glass-1 mt-1 w-full rounded-lg px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs">
                진행률 (0~1)
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={editing.progress}
                  onChange={(ev) => setEditing({ ...editing, progress: Number(ev.target.value) })}
                  className="glass-1 mt-1 w-full rounded-lg px-2 py-1 text-xs"
                />
              </label>
              <label className="text-xs">
                참여자 수
                <input
                  type="number"
                  value={editing.participants}
                  onChange={(ev) =>
                    setEditing({ ...editing, participants: Number(ev.target.value) })
                  }
                  className="glass-1 mt-1 w-full rounded-lg px-2 py-1 text-xs"
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
                className="rounded-xl bg-holographic px-4 py-2 text-sm font-bold text-[var(--color-bg-0)]"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
