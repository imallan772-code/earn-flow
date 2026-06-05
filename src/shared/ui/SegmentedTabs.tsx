/**
 * SegmentedTabs — pill segmented control with optional 2-line labels.
 *
 * Holographic active indicator using shared layoutId. Design tokens only.
 */
import { m } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { springSnappy } from "@/shared/motion/springs";

export interface SegmentedTabItem<T extends string> {
  id: T;
  label: string;
  sub?: string;
  icon?: ReactNode;
}

interface Props<T extends string> {
  value: T;
  onChange: (id: T) => void;
  items: ReadonlyArray<SegmentedTabItem<T>>;
  className?: string;
  /** Shared layoutId for the active pill; unique per mount group. */
  layoutId?: string;
}

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
  className,
  layoutId = "segmented-tabs-pill",
}: Props<T>) {
  return (
    <div
      role="tablist"
      className={cn("glass-1 flex items-stretch gap-1 rounded-2xl p-1", className)}
    >
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active
                ? "text-(--color-bg-0)"
                : "text-(--color-muted) hover:text-(--color-foreground)",
            )}
          >
            {active && (
              <m.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-xl bg-holographic shadow-glow-purple"
                transition={springSnappy}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {it.icon}
              <span className="flex flex-col items-start leading-tight">
                <span className="text-sm font-extrabold">{it.label}</span>
                {it.sub && (
                  <span
                    className={cn("text-[10px] font-medium", active ? "opacity-80" : "opacity-70")}
                  >
                    {it.sub}
                  </span>
                )}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
