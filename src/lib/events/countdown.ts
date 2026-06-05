export interface CountdownParts {
  d: number;
  h: number;
  m: number;
  s: number;
  done: boolean;
}

export function countdownTo(targetIso: string, nowMs = Date.now()): CountdownParts {
  const diff = Math.max(0, new Date(targetIso).getTime() - nowMs);
  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
    done: diff <= 0,
  };
}

export function countdownTargetForEvent(status: string, startsAt: string, endsAt: string): string {
  return status === "예정" ? startsAt : endsAt;
}
