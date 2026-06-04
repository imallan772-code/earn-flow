/**
 * GameRulesCard — collapsible "how this game works" panel.
 *
 * Default collapsed to save space. Open state persisted per-game in
 * localStorage so returning users get their preference.
 */
import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ShieldCheck } from "lucide-react";
import type { GameRules } from "@/shared/games/rules/gameRules";
import { cn } from "@/lib/utils";

interface Props {
  rules: GameRules;
  onVerify?: () => void;
}

export function GameRulesCard({ rules, onVerify }: Props) {
  const storageKey = `phonara.rules.${rules.id}.open`;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOpen(window.localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, next ? "1" : "0");
    }
  }

  return (
    <div className="glass-1 overflow-hidden rounded-2xl">
      <button
        onClick={toggle}
        className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-xs font-bold">
          <BookOpen size={14} className="text-[var(--color-cyan)]" />
          <span>게임 룰 · {rules.name}</span>
          {!open && (
            <span className="text-[10px] font-normal text-[var(--color-muted-2)]">
              (펼쳐서 보기)
            </span>
          )}
        </span>
        <ChevronDown
          size={16}
          className={cn(
            "text-[var(--color-muted)] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-[var(--color-border)] px-3.5 py-3">
            <ul className="flex flex-col gap-3">
              {rules.sections.map((s) => (
                <li key={s.title}>
                  <div className="text-[11px] font-bold text-[var(--color-cyan)]">
                    ▸ {s.title}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-[11px] leading-relaxed text-[var(--color-muted)]">
                    {s.body}
                  </p>
                </li>
              ))}
              {onVerify && (
                <li>
                  <button
                    onClick={onVerify}
                    className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[color-mix(in_oklab,var(--color-emerald)_18%,transparent)] px-3 py-1.5 text-[11px] font-bold text-[var(--color-emerald)]"
                  >
                    <ShieldCheck size={12} />
                    공정성 검증하기 →
                  </button>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
