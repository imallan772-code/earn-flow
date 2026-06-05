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
      body: "배수가 1.00x부터 위로 상승합니다. 언제든 캐쉬아웃 가능하지만, 그래프가 터지기(BUST) 전에 빠져나오지 못하면 베팅액 전액을 잃습니다.",
    },
    {
      title: "승리 조건",
      body: "터지기 전에 캐쉬아웃하면 (현재 배수 × 베팅액) 만큼을 받습니다. 늦게 캐쉬아웃할수록 수익이 커지지만, 그만큼 BUST 위험도 같이 커집니다.",
    },
    {
      title: "자동 캐쉬아웃",
      body: "목표 배수를 미리 설정하면, 그 배수에 도달하는 순간 자동으로 정산됩니다. 자동 모드와 함께 사용하면 손 떼고 라운드를 돌릴 수 있어요.",
    },
    {
      title: "배당 계산",
      body: "순수익 = 베팅액 × (캐쉬아웃 배수 × RTP − 1). 예: 10 USDT를 2.00x에서 캐쉬아웃 → +9.40 USDT (RTP 97%).",
    },
    {
      title: "데모 vs 리얼",
      body: "• 데모: 1회 체험 크레딧 ₩10,000 지급, 추가 리필 없음. RTP 97% (리얼과 동일).\n• 리얼: 실제 입금/출금. RTP 97% (3% 하우스 엣지).",
    },
    {
      title: "공정성 (Provably Fair)",
      body: "서버 시드 + 클라이언트 시드 + 라운드 번호를 HMAC-SHA256으로 계산해 BUST 지점을 미리 결정합니다. 라운드 종료 후 서버 시드가 공개되어 누구나 검증할 수 있습니다.",
    },
  ],
};

export const DICE_RULES: GameRules = {
  id: "dice",
  name: "Dice",
  sections: [
    {
      title: "기본 규칙",
      body: "0.00 ~ 99.99 사이의 숫자가 무작위로 굴려집니다. 베팅 버튼을 누르는 즉시 결과가 나옵니다(대기 타이머 없음). 목표값(target)보다 높게(OVER) 나오는 데 베팅할지, 낮게(UNDER) 나오는 데 베팅할지 선택하세요.",
    },
    {
      title: "승리 조건",
      body: "OVER 모드: 결과가 목표값보다 높으면 승리. UNDER 모드: 결과가 목표값보다 낮으면 승리. 결과가 같으면 패배(loss) 처리됩니다.",
    },
    {
      title: "배당 계산",
      body: "배당 = (99 × RTP) / 승리 확률(%). 승률이 낮을수록 배당이 높습니다. 예: 50% 승률 → 1.92x (RTP 97%).",
    },
    {
      title: "데모 vs 리얼",
      body: "• 데모: 1회 체험 크레딧 ₩10,000, 추가 리필 없음. RTP 97% (리얼과 동일).\n• 리얼: 실제 입금/출금. RTP 97% (3% 하우스 엣지).",
    },
    {
      title: "공정성 (Provably Fair)",
      body: "서버 시드 + 클라이언트 시드 + 라운드 번호로 HMAC-SHA256을 계산해 결과 숫자를 결정론적으로 산출합니다. 결과는 조작 불가능합니다.",
    },
  ],
};

export const PLINKO_RULES: GameRules = {
  id: "plinko",
  name: "Plinko",
  sections: [
    {
      title: "기본 규칙",
      body: "공을 위에서 떨어뜨리면 핀에 부딪히며 좌우로 튕기다 하단 슬롯에 안착합니다. 슬롯마다 배율이 다르고, 가장자리로 갈수록 배율이 커집니다(대신 들어갈 확률은 낮음).",
    },
    {
      title: "줄 수 & 리스크",
      body: "• 줄 수(8/12/16): 많을수록 슬롯이 늘어나고 분포가 정규분포에 가까워집니다.\n• 리스크(낮음/보통/높음): 같은 줄 수에서도 양 끝 배율과 중앙 배율의 차이가 달라집니다. 높을수록 한방 노림수, 낮을수록 잦은 소액 회수.",
    },
    {
      title: "배당 계산",
      body: "수익 = 베팅액 × 슬롯 배율 − 베팅액. 예: 10 USDT × 5.0x → 순수익 +40 USDT. 모든 모드에 RTP 97%가 적용됩니다.",
    },
    {
      title: "데모 vs 리얼",
      body: "• 데모: 1회 체험 크레딧 ₩10,000, 추가 리필 없음. RTP 97% (리얼과 동일).\n• 리얼: 실제 입금/출금. RTP 97% (3% 하우스 엣지).",
    },
    {
      title: "공정성 (Provably Fair)",
      body: "서버 시드 + 라운드 번호로 HMAC-SHA256 해시를 만들고, 각 줄에서의 좌/우 튕김 방향을 비트 단위로 결정합니다. 결과 슬롯은 사전에 고정되어 있어 조작 불가능합니다.",
    },
  ],
};

export const MINES_RULES: GameRules = {
  id: "mines",
  name: "Mines",
  sections: [
    {
      title: "기본 규칙",
      body: "5×5(25칸) 보드에서 지뢰 개수를 직접 설정합니다(1~24). 베팅 후 안전 타일을 한 칸씩 깔수록 캐쉬아웃 배수가 올라갑니다. 지뢰를 밟으면 베팅액 전액을 잃습니다.",
    },
    {
      title: "승리 조건",
      body: "지뢰를 피해 안전 타일을 깐 직후 언제든 캐쉬아웃 가능합니다. 더 많이 깔수록 배수는 커지지만, 다음 칸에서 지뢰를 밟을 확률도 올라갑니다.",
    },
    {
      title: "배당 계산",
      body: "배수(r 안전 타일 후) = 0.99 × ∏(25-i)/(25-M-i) (i=0..r-1, M=지뢰 수). 정산은 모드 RTP 97%를 한 번 더 적용합니다(엔진 RTP 99% × 모드 0.97 = 96.03% 실효 RTP).",
    },
    {
      title: "지뢰 수 선택",
      body: "• 1~3개: 안전 위주, 잦은 소액 회수.\n• 5~10개: 균형형.\n• 12개 이상: 한방 노림수, 첫 칸부터 큰 배수.",
    },
    {
      title: "데모 vs 리얼",
      body: "• 데모: 1회 체험 크레딧 ₩10,000, 추가 리필 없음. RTP 97% (리얼과 동일).\n• 리얼: 실제 입금/출금. RTP 97% (3% 하우스 엣지).",
    },
    {
      title: "키보드 단축키",
      body: "• 1–0 키: 상단 10칸(0~9번 타일) 즉시 깔기.\n• R: 남은 안전 타일 중 랜덤 1개 깔기.\n• C: 캐쉬아웃. ESC: 공정성 모달 닫기.",
    },
    {
      title: "공정성 (Provably Fair)",
      body: "라운드 시작 전 서버 시드 해시를 공개합니다. 지뢰 배치 = Fisher-Yates 셔플(HMAC-SHA256(serverSeed, clientSeed:nonce:cursor))의 첫 M개 인덱스. 라운드 종료 후 서버 시드가 공개되어 누구나 재현 검증할 수 있습니다.",
    },
  ],
};

export const LIMBO_RULES: GameRules = {
  id: "limbo",
  name: "Limbo",
  sections: [
    {
      title: "기본 규칙",
      body: "베팅 전에 목표 배수(1.01x ~ 1,000,000x)를 설정합니다. 라운드가 결정되면 결과 배수가 즉시 공개되며, 결과가 목표 배수 이상이면 승리, 미만이면 패배입니다.",
    },
    {
      title: "승리 조건",
      body: "결과 배수 ≥ 목표 배수 → 승리(목표 배수만큼 정산). 결과 배수 < 목표 배수 → 패배(베팅액 전액 손실). 결과 == 목표는 승리로 처리됩니다.",
    },
    {
      title: "배당 계산",
      body: "승률 ≈ 99 / 목표 배수 (%). 배당 = 목표 배수. 모드 RTP 97%가 한 번 더 적용됩니다(엔진 RTP 99% × 모드 0.97 = 96.03% 실효 RTP).",
    },
    {
      title: "데모 vs 리얼",
      body: "• 데모: 1회 체험 크레딧 ₩10,000, 추가 리필 없음. RTP 97% (리얼과 동일).\n• 리얼: 실제 입금/출금. RTP 97% (3% 하우스 엣지).",
    },
    {
      title: "키보드 단축키",
      body: "• Space: 활성 슬롯 베팅. • ↑/↓: 목표 배수 ±0.1. • Shift+↑/↓: ±1.0. • 1/2: 활성 슬롯 전환. • P: 공정성. • M: 음소거.",
    },
    {
      title: "공정성 (Provably Fair)",
      body: "결과 배수 = floor((100 - u) / (1 - u)) / 100, u = floatFromBytes(HMAC-SHA256(serverSeed, clientSeed:nonce:0)). 동일 시드/라운드는 항상 같은 결과를 만듭니다.",
    },
  ],
};

export const WHEEL_RULES: GameRules = {
  id: "wheel",
  name: "Wheel",
  sections: [
    {
      title: "기본 규칙",
      body: "위험도(낮음/보통/높음)와 세그먼트 수(10/20/30)를 선택하고 회전합니다. 휠이 멈춘 위치의 배수만큼 정산됩니다(0×이면 패배).",
    },
    {
      title: "위험도 선택",
      body: "• 낮음: 1.2~1.5× 위주 잦은 소액 회수, 0× 일부.\n• 보통: 1.8~3× 중심, 0× 다수 — 균형형.\n• 높음: 슬롯 하나에 큰 jackpot, 나머지 0× — 한방 노림.",
    },
    {
      title: "배당 계산",
      body: "수익 = 베팅액 × 슬롯 배수 − 베팅액. 슬롯 배수 0이면 베팅액 전액 손실. 모든 모드에 RTP 97%가 정산 시 추가 적용됩니다(엔진 RTP 99% × 모드 0.97).",
    },
    {
      title: "데모 vs 리얼",
      body: "• 데모: 1회 체험 크레딧 ₩10,000, 추가 리필 없음. RTP 97% (리얼과 동일).\n• 리얼: 실제 입금/출금. RTP 97% (3% 하우스 엣지).",
    },
    {
      title: "공정성 (Provably Fair)",
      body: "결과 인덱스 = floor(u × segments), u = floatFromBytes(HMAC-SHA256(serverSeed, clientSeed:nonce:0)). 배수 테이블은 (위험도, 세그먼트)별로 공개되어 있어 누구나 평균 RTP를 검증할 수 있습니다.",
    },
  ],
};

export const RULES_BY_GAME: Record<string, GameRules> = {
  crash: CRASH_RULES,
  dice: DICE_RULES,
  plinko: PLINKO_RULES,
  mines: MINES_RULES,
  limbo: LIMBO_RULES,
  wheel: WHEEL_RULES,
};
