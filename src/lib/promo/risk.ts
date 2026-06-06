/**
 * Local risk scan — keyword + heuristic only.
 * Z-1에서 AI scanPromoRisk로 보강.
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
  const level: RiskResult["level"] = score >= 60 ? "high" : score >= 25 ? "medium" : "low";
  return { score, flags: hits, level };
}
