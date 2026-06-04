## 계산은 정상, 다만 표시 방식이 혼동을 유발

### 현재 로직 (PlinkoBoard.tsx:133-149)
- 베팅 시점에 잔액에서 베팅액 차감 (`setBalance(b => b - amount)`)
- 착지 후 `payout = amount × multiplier` 만큼 잔액에 환급
- `profit = payout - amount` (순손익)

예) 10 베팅 → 잔액 -10. x1.5 슬롯 → +15 환급. **순이익 = +5, 최종 +5**
이는 Stake/카지노 표준 회계입니다 (x1.0이면 본전, profit 0).

### 그런데 진짜 버그가 하나 있음
`mode === "real"`일 때 `effectiveMult = multiplier × 0.97`로 **표시되는 배율 자체를 깎아버림** (134행).
→ 슬롯은 1.5x로 적혀 있는데 라이브 피드/결과에는 1.455x로 표시되고 profit도 +4.55. 유저 입장에선 "1.5라며 왜 1.455?" 가 됨.

### Plan (3 small edits, 1 file)

**1. `PlinkoBoard.tsx` 라인 133-149 — 하우스엣지 처리 분리**
```ts
const grossPayout = amount * multiplier;        // 슬롯 그대로
const rake = mode === "real" ? grossPayout * 0.03 : 0;
const payout = grossPayout - rake;              // 실제 환급
const profit = payout - amount;
const won = payout >= amount;
// 표시 배율은 항상 슬롯 그대로 multiplier 사용
liveBetsStore.update(liveBetId, {
  multiplier: won ? multiplier : null,          // ← effectiveMult 아닌 원본
  profit: +profit.toFixed(2),
  status: won ? "win" : "loss",
});
```

**2. `lastOutcome.multiplier`도 원본 `multiplier`로 (146행)** — 결과 카드에 1.5x 그대로 표시.

**3. (선택) 결과 카드에 "베팅 10 × 1.5 = 15 (순이익 +5)" 한 줄 추가**해서 계산식 노출 → 향후 동일 질문 차단.

### 영향 범위
- `PlinkoBoard.tsx`만 수정. Engine/Renderer/LiveBetsStore 변경 없음.
- `mode === "fun"`에선 동작 100% 동일 (rake=0).
- `mode === "real"`에선 잔액 결과는 기존과 동일 (3% 하우스엣지 유지), **표시되는 배율만 슬롯 라벨과 일치**.

### Verification
- 10 베팅 → x1.5 fun 모드: 잔액 변화 +5, 배율 표시 "1.5x", profit "+5.00"
- 10 베팅 → x1.5 real 모드: 잔액 변화 +4.55, 배율 표시 "1.5x", profit "+4.55"
- 10 베팅 → x1.0 모드: 배율 "1.0x", profit "0.00" (본전)
- 10 베팅 → x0.5 모드: 배율 "0.5x", profit "-5.00"

### 추가로 확인이 필요한 것
**유저가 기대하는 동작이 둘 중 어느 쪽인지** 명확히 해주시면 좋겠습니다:
- (A) **표준 카지노 방식** — 베팅 즉시 차감, payout = bet × mult, 순이익 = bet × (mult-1). x1.5면 +5 이익. (현재 + 위 패치)
- (B) **보너스 방식** — 베팅 차감 없이 추가로 bet × mult 지급. x1.5면 +15 이익. (이 경우 모든 게임 회계 재설계 필요)

업계 표준은 (A)이며 Dice/Crash도 동일하게 동작 중입니다. (A)로 진행해도 될까요?
