import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  groupCampaignsByDay,
  shiftMonth,
  ymdKey,
} from "../calendarGrid";
import type { PromoCampaign } from "@/features/admin/promo/types";

function camp(id: string, isoLocal: string): PromoCampaign {
  return {
    id,
    title: id,
    brief: "",
    targetUrl: "",
    channels: [],
    variants: [],
    scheduledAt: new Date(isoLocal).toISOString(),
    status: "scheduled",
    riskScore: 0,
  };
}

describe("calendarGrid", () => {
  it("ymdKey returns local YYYY-MM-DD", () => {
    const k = ymdKey(new Date(2026, 5, 6, 10, 30));
    expect(k).toBe("2026-06-06");
  });

  it("buildMonthGrid is 6 rows × 7 cols with month boundary correct", () => {
    const grid = buildMonthGrid(2026, 5, []); // June 2026
    expect(grid).toHaveLength(6);
    grid.forEach((row) => expect(row).toHaveLength(7));
    const inMonth = grid.flat().filter((c) => c.inMonth);
    expect(inMonth.length).toBe(30);
  });

  it("groupCampaignsByDay groups multiple same-day campaigns", () => {
    const a = camp("a", "2026-06-06T09:00:00");
    const b = camp("b", "2026-06-06T15:00:00");
    const c = camp("c", "2026-06-07T09:00:00");
    const m = groupCampaignsByDay([a, b, c]);
    expect(m.get("2026-06-06")?.length).toBe(2);
    expect(m.get("2026-06-07")?.length).toBe(1);
    expect(m.get("2026-06-06")?.[0].id).toBe("a");
  });

  it("buildMonthGrid attaches campaigns to correct day cell", () => {
    const c = camp("x", "2026-06-15T12:00:00");
    const grid = buildMonthGrid(2026, 5, [c]);
    const cell = grid.flat().find((d) => d.ymd === "2026-06-15");
    expect(cell?.campaigns.length).toBe(1);
    expect(cell?.campaigns[0].id).toBe("x");
  });

  it("shiftMonth wraps across year boundary", () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, month: 11 });
  });

  it("handles empty campaigns array", () => {
    const grid = buildMonthGrid(2026, 1, []);
    expect(grid.flat().every((c) => c.campaigns.length === 0)).toBe(true);
  });
});
