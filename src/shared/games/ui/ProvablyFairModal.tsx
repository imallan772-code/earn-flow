import { useEffect, useRef, type ReactNode } from "react";
import { Copy, Sparkles, X } from "lucide-react";

export interface ProvablyFairRow {
  label: string;
  content: ReactNode;
  copyText?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  rows: ProvablyFairRow[];
  footer?: ReactNode;
  onApply?: () => void;
  applyLabel?: string;
}

export function ProvablyFairModal({
  open,
  onClose,
  title = "공정성 검증",
  rows,
  footer,
  onApply,
  applyLabel = "시드 적용",
}: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
      if (!root) return;
      const focusables = root.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])',
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={containerRef}
        className="glass-2 w-full max-w-md rounded-t-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-lg font-extrabold">
            <Sparkles size={16} className="text-gold" />
            {title}
          </h2>
          <button ref={closeRef} onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>
        <dl className="flex flex-col gap-3 text-xs">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-3">
              <dt className="shrink-0 text-(--color-muted)">{row.label}</dt>
              <dd className="min-w-0 text-right">
                {row.content}
                {row.copyText ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(row.copyText!);
                      }
                    }}
                    className="ml-1.5 inline-flex rounded-md bg-(--color-surface-hi) p-1.5 hover:bg-bg-2"
                    aria-label={`${row.label} 복사`}
                  >
                    <Copy size={11} />
                  </button>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
        {onApply ? (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl bg-(--color-surface-hi) py-2.5 text-sm font-extrabold"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onApply}
              className="flex-1 rounded-xl bg-warning py-2.5 text-sm font-extrabold text-(--color-bg-0) shadow-glow-gold"
            >
              {applyLabel}
            </button>
          </div>
        ) : null}
        {footer ? (
          <div className="mt-3 text-[10px] leading-relaxed text-(--color-muted)">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
