## 라운드 C — Dice 게임 + Round A 테스트 픽스 (6파트)

Stake.com Dice 1:1 — 슬라이더, Over/Under, 1% 하우스엣지. 5개 PR + 사전 정리.

---

### C0. Round A 테스트 픽스 (사전 정리, 작음)
산출: `src/shared/games/engine/clamp.ts`, `__tests__/autoBet.spec.ts`
- `round(1.005)` 부동소수점 → `Math.round((v + Number.EPSILON) * k) / k`로 교정
- autoBet "Flat + onLossIncreasePct=50" 기대값 보정 (반복 곱셈 누적 검증)
- 결과: 28/28 GREEN

### C1. DiceEngine (순수 로직, DOM 0)
산출: `src/shared/games/dice/DiceEngine.ts`
- 결정론 roll: `floatFromBytes(HMAC(serverSeed, clientSeed:nonce:0)) * 10000 / 100` → `roll ∈ [0.00, 99.99]`
- `winChance(target, mode)`:
  - Over: `(99.99 - target) / 99.99 * 100`
  - Under: `target / 99.99 * 100`
- `payoutMultiplier(winChance)` = `99 / winChance` (1% 하우스엣지 → RTP 99%)
- `isWin(roll, target, mode)` pure
- React/DOM 의존 0

### C2. DiceEngine 단위 테스트
산출: `src/shared/games/dice/__tests__/diceEngine.spec.ts`
- 결정론 1000회 동일 seed → 동일 roll
- `roll ∈ [0, 99.99]` invariant
- payout × winChance ≈ 99 (1% 엣지 검증)
- RTP 99% ± 1% (2000회 시뮬, target=50 Over)
- Over/Under 대칭성: same target → winChance 합 = 100%

### C3. DiceSlider (인터랙티브 UI)
산출: `src/shared/games/dice/DiceSlider.tsx`
- 0~99.99 슬라이더, target 드래그
- Over/Under 모드 토글 → 슬라이더 색상 빨강/초록 영역 반전
- 실시간 표시: WinChance / Multiplier / Roll Over(또는 Under)
- 색상 100% 토큰

### C4. DiceScreen + 라우트
산출: `src/features/games/dice/DiceScreen.tsx`, `src/routes/_app/games.dice.tsx`
- 상단: 최근 30 roll 히스토리 chip (승=초록, 패=빨강)
- 중앙: DiceSlider + 마지막 roll 거대 표시 + 결과 애니메이션 (win flash / loss shake)
- 하단: `<StakeBetPanel>` 재사용 (Round B에서 만든 공용 컴포넌트)
- Provably Fair 시트 (Crash와 동일 패턴)

### C5. 게임 로비 + Earn 탭 통합
산출: `src/features/games/GameLobby.tsx`, `src/routes/_app/earn.tsx` 수정
- 8개 게임 카드 그리드 (2열)
  - Crash, Dice — **OPEN**
  - Slots, Roulette, RPS, LuckyBox, CardFlip, Keepy-Uppy — **SOON** 배지
- 각 카드: 아이콘, 이름, RTP, "Live Bets" 카운트 (mock)
- Earn 탭에 GameLobby 그리드 삽입

---

### 라운드 C 게이트
1. C0 픽스 포함 vitest 전체 GREEN (28→33+개)
2. Dice 결정론·RTP·invariant 모두 PASS
3. 색상 토큰 100%
4. 라우트 `/games/dice` 진입 + 슬라이더/베팅 동작
5. Earn 탭에서 Crash·Dice 카드 클릭 → 해당 게임 진입

### 다음 라운드 예고
- **D**: Slots (D1 릴/페이라인 엔진 / D2 테스트 / D3 릴 애니메이션 Canvas / D4 화면)
- **E**: Roulette (E1 휠 엔진 / E2 베팅 보드 / E3 휠 Canvas / E4 화면)
- **F**: RPS · LuckyBox · CardFlip (간단 게임 묶음, 각 3파트)
- **G**: Keepy-Uppy (물리 워커 별도)
- **H**: 트레이딩 터미널 Spot / Futures
- **I**: 입출금 (USDT / KRW / 상품권)
- **J**: 어드민 잔여

---

**이번 라운드는 C0~C5만 실행** — 작은 픽스 1건 + 5개 신규. Dice 끝나면 8게임 중 2개 가동.
