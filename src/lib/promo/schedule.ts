/**
 * Minimal cron-ish schedule helper.
 * 지원: "every Nm" / "every Nh" / "daily HH:MM" (UTC base).
 * Z-1에서 real cron expr 확장.
 */
export function nextTickAt(expr: string, from: Date = new Date()): Date | null {
  const trimmed = expr.trim().toLowerCase();
  const every = trimmed.match(/^every\s+(\d+)\s*(m|h)$/);
  if (every) {
    const n = Number(every[1]);
    const unit = every[2];
    const ms = unit === "h" ? n * 3600_000 : n * 60_000;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    return new Date(from.getTime() + ms);
  }
  const daily = trimmed.match(/^daily\s+(\d{1,2}):(\d{2})$/);
  if (daily) {
    const h = Number(daily[1]);
    const m = Number(daily[2]);
    if (h > 23 || m > 59) return null;
    const next = new Date(from);
    next.setUTCHours(h, m, 0, 0);
    if (next.getTime() <= from.getTime()) next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }
  return null;
}
