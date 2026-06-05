import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Trophy, Sparkles } from "lucide-react";
import { useActiveEvents } from "@/shared/events/useEvents";

export function EventHero() {
  const list = useActiveEvents(3);
  const [i, setI] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (list.length < 2) return;
    const id = setInterval(() => setI((v) => (v + 1) % list.length), 5000);
    return () => clearInterval(id);
  }, [list.length]);
  if (list.length === 0) return null;

  return (
    <section ref={ref} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-gold)]">
          <Sparkles size={12} /> 진행중 이벤트
        </div>
        <Link to="/event" className="text-[11px] text-[var(--color-muted)]">
          전체 →
        </Link>
      </div>
      <div className="relative overflow-hidden rounded-3xl">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${i * 100}%)` }}
        >
          {list.map((e) => (
            <Link
              key={e.id}
              to="/event/$id"
              params={{ id: e.id }}
              className="relative block w-full shrink-0 p-5 shadow-depth-2"
              style={{
                background: `linear-gradient(135deg, color-mix(in oklab, ${e.bgFrom} 45%, var(--color-bg-1)), color-mix(in oklab, ${e.bgTo} 45%, var(--color-bg-1)))`,
              }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-25 mix-blend-overlay"
                style={{
                  background: "radial-gradient(ellipse at top right, white, transparent 60%)",
                }}
              />
              <div className="relative flex flex-col gap-2">
                <span className="w-fit rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold backdrop-blur">
                  {e.tagline}
                </span>
                <h3 className="text-lg font-extrabold leading-tight">{e.title}</h3>
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <Trophy size={12} className="text-[var(--color-gold)]" />
                  {e.rewardPreview}
                </div>
              </div>
            </Link>
          ))}
        </div>
        {list.length > 1 && (
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {list.map((_, idx) => (
              <span
                key={idx}
                className="h-1 rounded-full transition-all"
                style={{
                  width: idx === i ? 16 : 6,
                  background:
                    idx === i
                      ? "var(--color-foreground)"
                      : "color-mix(in oklab, var(--color-foreground) 40%, transparent)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
