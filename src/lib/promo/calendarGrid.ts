/**
 * Promo calendar — pure month grid utilities.
 * No server imports. Local timezone consistent (uses Date local getters).
 */
import type { PromoCampaign } from "@/features/admin/promo/types";

export interface DayCell {
  date: Date;
  ymd: string;
  inMonth: boolean;
  campaigns: PromoCampaign[];
}

/** YYYY-MM-DD key using local timezone (matches what month grid renders). */
export function ymdKey(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function groupCampaignsByDay(campaigns: PromoCampaign[]): Map<string, PromoCampaign[]> {
  const map = new Map<string, PromoCampaign[]>();
  for (const c of campaigns) {
    if (!c.scheduledAt) continue;
    const key = ymdKey(c.scheduledAt);
    if (!key) continue;
    const arr = map.get(key) ?? [];
    arr.push(c);
    map.set(key, arr);
  }
  // sort within day by scheduledAt asc
  for (const [, arr] of map) {
    arr.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  }
  return map;
}

/** Build 6×7 grid for the given month. weekStart=0 (Sun). */
export function buildMonthGrid(
  year: number,
  month: number, // 0-based
  campaigns: PromoCampaign[],
  weekStart: 0 | 1 = 0,
): DayCell[][] {
  const grouped = groupCampaignsByDay(campaigns);
  const first = new Date(year, month, 1);
  const firstWeekday = first.getDay(); // 0..6
  const leading = (firstWeekday - weekStart + 7) % 7;
  const start = new Date(year, month, 1 - leading);

  const weeks: DayCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      const ymd = ymdKey(date);
      row.push({
        date,
        ymd,
        inMonth: date.getMonth() === month,
        campaigns: grouped.get(ymd) ?? [],
      });
    }
    weeks.push(row);
  }
  return weeks;
}

export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}
