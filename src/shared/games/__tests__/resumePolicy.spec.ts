import { describe, expect, it } from "vitest";
import {
  assertResumeFirstPolicy,
  AUTO_BET_STOP,
  CRASH_ROUND_MAX_LIFETIME_MS,
  GA0_PR_CHECKLIST,
  PLINKO_QUEUE_RESUME,
  RESUME_FIRST_POLICY,
} from "../resumePolicy";

describe("resumePolicy (GA-0)", () => {
  it("forbids all navigation-triggered refunds", () => {
    expect(RESUME_FIRST_POLICY.refundOnUnmount).toBe(false);
    expect(RESUME_FIRST_POLICY.refundOnNavigation).toBe(false);
    expect(RESUME_FIRST_POLICY.refundOnRefresh).toBe(false);
    expect(RESUME_FIRST_POLICY.refundOnBeforeUnload).toBe(false);
    expect(() => assertResumeFirstPolicy()).not.toThrow();
  });

  it("Plinko stale queue uses auto-settle not refund", () => {
    expect(PLINKO_QUEUE_RESUME.staleAction).toBe("server_auto_settle_not_refund");
    expect(PLINKO_QUEUE_RESUME.onUnmount).toBe("no_refund");
  });

  it("auto-bet stop completes in-flight round before stopped", () => {
    expect(AUTO_BET_STOP.stopWithInflight).toBe("status_stopping_complete_round_then_stopped");
  });

  it("Crash max lifetime is 60 minutes", () => {
    expect(CRASH_ROUND_MAX_LIFETIME_MS).toBe(60 * 60 * 1000);
  });

  it("PR checklist includes unmount refund ban", () => {
    expect(GA0_PR_CHECKLIST.some((c) => c.includes("unmount"))).toBe(true);
  });
});
