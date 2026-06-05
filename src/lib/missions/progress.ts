import type { UserMission } from "./schemas";

export function missionProgressPct(m: Pick<UserMission, "progress" | "total">): number {
  if (m.total <= 0) return 0;
  return Math.min(100, (m.progress / m.total) * 100);
}

export function canClaimMission(
  m: Pick<UserMission, "progress" | "total" | "claimed_at" | "can_claim">,
): boolean {
  if (m.can_claim != null) return m.can_claim;
  return m.progress >= m.total && m.claimed_at == null;
}

export function isMissionClaimed(m: Pick<UserMission, "claimed_at">): boolean {
  return m.claimed_at != null;
}
