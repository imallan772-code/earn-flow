import { MOCK_MARQUEE_ROWS, type MarqueeRow } from "@/mocks/fomo";

const accentClass: Record<MarqueeRow["accent"], string> = {
  cyan: "text-[var(--color-cyan)]",
  purple: "text-[var(--color-purple)]",
  pink: "text-[var(--color-pink)]",
  gold: "text-[var(--color-gold)]",
};

function Row({ rows, reverse }: { rows: MarqueeRow[]; reverse?: boolean }) {
  const doubled = [...rows, ...rows];
  return (
    <div className="relative w-full overflow-hidden">
      <div
        className={`flex w-max gap-8 whitespace-nowrap py-2 ${reverse ? "animate-marquee-rev" : "animate-marquee"}`}
      >
        {doubled.map((r, i) => (
          <span key={r.id + i} className={`text-sm ${accentClass[r.accent]}`}>
            {r.text}
          </span>
        ))}
      </div>
    </div>
  );
}

export function FomoMarquee() {
  const half = Math.ceil(MOCK_MARQUEE_ROWS.length / 2);
  return (
    <div className="glass-1 rounded-2xl">
      <Row rows={MOCK_MARQUEE_ROWS.slice(0, half)} />
      <div className="h-px w-full" style={{ background: "var(--color-border)" }} />
      <Row rows={MOCK_MARQUEE_ROWS.slice(half)} reverse />
    </div>
  );
}
