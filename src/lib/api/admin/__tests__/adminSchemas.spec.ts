import { describe, expect, it } from "vitest";
import { adminDashboardStatsSchema, adminNoticeInputSchema } from "@/lib/api/admin/schemas";

describe("admin schemas", () => {
  it("parses dashboard stats", () => {
    const stats = adminDashboardStatsSchema.parse({
      total_users: "42",
      signups_today: 3,
      published_events: 2,
      published_notices: 6,
    });
    expect(stats.total_users).toBe(42);
    expect(stats.signups_today).toBe(3);
  });

  it("validates notice upsert payload", () => {
    const row = adminNoticeInputSchema.parse({
      id: "n-test",
      category: "공지",
      title: "테스트",
      excerpt: "요약",
      body: "본문",
      pinned: false,
      published_at: "2026-06-06T00:00:00.000Z",
      author: "운영팀",
      is_published: true,
    });
    expect(row.id).toBe("n-test");
  });
});
