/**
 * Game rules data — 5 standardized sections per game.
 * Friendly Korean explainers, used by GameRulesCard.
 */

export interface RuleSection {
  title: string;
  body: string;
}

export interface GameRules {
  id: string;
  name: string;
  sections: RuleSection[];
}

export const CRASH_RULES: GameRules = {
  id: "crash",
  name: "Crash",
  sections: [
    {
      title: "기본 규칙",
      body:
        "배수가 1.00x부터 위로 상승합니다. 언제든 캐쉬아웃 가능하지만, 그래프가 터지기(BUST) 전에 빠져나오지 못하면 베팅액 전액을 잃습니다.",
    },
    {
      title: "승리 조건",
      body:
        "터지기 전에 캐쉬아웃하면 (현재 배수 × 베팅액) 만큼을 받습니다. 늦게 캐쉬아웃할수록 수익이 커지지만, 그만큼 BUST 위험도 같이 커집니다.",
    },
    {
      title: "자동 캐쉬아웃",
      body:
        "목표 배수를 미리 설정하면, 그 배수에 도달하는 순간 자동으로 정산됩니다. 자동 모드와 함께 사용하면 손 떼고 라운드를 돌릴 수 있어요.",
    },
    {
      title: "배당 계산",
      body:
        "순수익 = 베팅액 × (캐쉬아웃 배수 × RTP − 1). 예: 10 USDT를 2.00x에서 캐쉬아웃 → 리얼 모드(97%)에서는 +9.40 USDT.",
    },
    {
      title: "데모 vs 리얼",
      body:
        "• 데모: 100% RTP, 가상 잔액 (마음껏 연습)\n• 리얼: 97% RTP, 실제 잔액 (3% 하우스 엣지)",
    },
    {
      title: "공정성 (Provably Fair)",
      body:
        "서버 시드 + 클라이언트 시드 + 라운드 번호를 HMAC-SHA256으로 계산해 BUST 지점을 미리 결정합니다. 라운드 종료 후 서버 시드가 공개되어 누구나 검증할 수 있습니다.",
    },
  ],
};

export const DICE_RULES: GameRules = {
  id: "dice",
  name: "Dice",
  sections: [
    {
      title: "기본 규칙",
      body:
        "0.00 ~ 99.99 사이의 숫자가 무작위로 굴려집니다. 목표값(target)보다 높게(OVER) 나오는 데 베팅할지, 낮게(UNDER) 나오는 데 베팅할지 선택하세요.",
    },
    {
      title: "승리 조건",
      body:
        "OVER 모드: 결과가 목표값보다 높으면 승리. UNDER 모드: 결과가 목표값보다 낮으면 승리. 결과가 같으면 패배(loss) 처리됩니다.",
    },
    {
      title: "배당 계산",
      body:
        "배당 = (99 × RTP) / 승리 확률(%). 승률이 낮을수록 배당이 높습니다. 예: 50% 승률 → 리얼 모드 1.92x, 데모 모드 1.98x.",
    },
    {
      title: "데모 vs 리얼",
      body:
        "• 데모: 100% RTP, 가상 잔액\n• 리얼: 97% RTP, 실제 잔액 (3% 하우스 엣지)",
    },
    {
      title: "공정성 (Provably Fair)",
      body:
        "서버 시드 + 클라이언트 시드 + 라운드 번호로 HMAC-SHA256을 계산해 결과 숫자를 결정론적으로 산출합니다. 결과는 조작 불가능합니다.",
    },
  ],
};

export const RULES_BY_GAME: Record<string, GameRules> = {
  crash: CRASH_RULES,
  dice: DICE_RULES,
};
