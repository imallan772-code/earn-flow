/**
 * Local risk scan — keyword + heuristic only.
 * Z-1: mergeRiskScores로 AI 점수와 병합.
 */
const HIGH_FLAGS = [
  "guaranteed",
  "보장",
  "100%",
  "확정수익",
  "원금보장",
  "도박",
  "casino",
  "free money",
  "공짜",
];

const MEDIUM_FLAGS = ["click here", "지금당장", "긴급", "한정", "limited time"];

export interface RiskResult {
  score: number; // 0~100
  flags: string[];
  level: "low" | "medium" | "high";
}

export function scanRiskLocal(text: string): RiskResult {
  const lower = text.toLowerCase();
  const hits: string[] = [];
  let score = 0;
  for (const k of HIGH_FLAGS) {
    if (lower.includes(k.toLowerCase())) {
      hits.push(k);
      score += 30;
    }
  }
  for (const k of MEDIUM_FLAGS) {
    if (lower.includes(k.toLowerCase())) {
      hits.push(k);
      score += 10;
    }
  }
  score = Math.min(100, score);
  return { score, flags: hits, level: levelFromScore(score) };
}

export function levelFromScore(score: number): RiskResult["level"] {
  return score >= 60 ? "high" : score >= 25 ? "medium" : "low";
}

/**
 * local + AI 결과 병합.
 * - score: max
 * - flags: union (중복 제거)
 * - level: merged score 기준 재계산
 */
export function mergeRiskScores(
  local: RiskResult,
  ai: { score: number; flags?: string[] } | null | undefined,
): RiskResult {
  if (!ai) return local;
  const score = Math.min(100, Math.max(local.score, Math.max(0, Math.round(ai.score))));
  const flags = Array.from(new Set([...local.flags, ...(ai.flags ?? [])]));
  return { score, flags, level: levelFromScore(score) };
}
