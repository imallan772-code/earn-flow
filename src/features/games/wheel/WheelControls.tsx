/**
 * WheelControls — Design B 리스크/세그먼트 컨트롤.
 * @theme tokens only. 펄 토글. disabled = !isIdle.
 */
import { memo } from "react";
import {
  WHEEL_RISKS,
  WHEEL_SEGMENT_OPTIONS,
  type WheelRisk,
  type WheelSegments,
} from "@/shared/games/wheel/WheelEngine";
import { cn } from "@/lib/utils";

interface Props {
  risk: WheelRisk;
  segments: WheelSegments;
  disabled: boolean;
  onRisk: (r: WheelRisk) => void;
  onSegments: (n: WheelSegments) => void;
}

const RISK_LABEL: Record<WheelRisk, string> = {
  low: "낮음",
  medium: "보통",
  high: "높음",
};

export const WheelControls = memo(function WheelControls({
  risk,
  segments,
  disabled,
  onRisk,
  onSegments,
}: Props) {
  return (
    <div className="glass-2 flex flex-col gap-3 rounded-3xl p-4">
      <Row label="위험도">
        {WHEEL_RISKS.map((r) => (
          <Pill key={r} active={risk === r} disabled={disabled} onClick={() => onRisk(r)}>
            {RISK_LABEL[r]}
          </Pill>
        ))}
      </Row>
      <Row label="세그먼트">
        {WHEEL_SEGMENT_OPTIONS.map((n) => (
          <Pill key={n} active={segments === n} disabled={disabled} onClick={() => onSegments(n)}>
            {n}
          </Pill>
        ))}
      </Row>
    </div>
  );
});

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-[10px] font-bold uppercase tracking-wider text-(--color-muted)">
        {label}
      </span>
      <div className="grid flex-1 grid-cols-3 gap-1.5">{children}</div>
    </div>
  );
}

function Pill({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-xl px-2 py-2 text-[11px] font-extrabold uppercase tracking-wider transition active:scale-[0.98] disabled:opacity-50",
        active
          ? "bg-(--color-cyan) text-(--color-bg-0) shadow-glow-cyan"
          : "bg-(--color-surface-hi) text-(--color-muted) hover:text-(--color-foreground)",
      )}
    >
      {children}
    </button>
  );
}
