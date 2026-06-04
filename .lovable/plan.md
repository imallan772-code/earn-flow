# Plinko v5.1.1 — 진짜 버그만 핀포인트 수정

리뷰 3개 중 **1개만 실체 있는 버그**. 나머지는 변수명 변경/이중 cap이라 무시.

## 검증 결과

| 리뷰 지적 | 판정 | 근거 |
|---|---|---|
| peg 좌표 불일치 | ❌ False | Renderer `(c+0.5)/(row+2)` ≡ Engine `(cumRight+0.5)/(row+2)`. 수식 동일, jitter 0 |
| useEffect deps eslint-disable | ⚠️ 사소 | useRef + if-guard로 Strict Mode 안전. 주석만 보강 |
| **MAX_MULT 하드코딩** | ✅ **True** | PlinkoBoard.tsx L279-287에 하드맵. 테이블 변경 시 BetSummary 거짓말 |
| ResizeObserver 390px cap | ❌ False | 부모 wrapper에서 이미 cap. 이중 cap은 미래 태블릿 대응 발목 |

## 수정 (3파일)

### 1. `src/shared/games/plinko/PlinkoEngine.ts`
파일 하단에 helper export 추가:
```ts
export function getMaxMultiplier(risk: RiskLevel, rows: RowCount): number {
  return Math.max(...MULTIPLIERS[risk][rows]);
}
```

### 2. `src/shared/games/plinko/PlinkoBoard.tsx`
- `maxMultFor` 함수 전체 삭제 (L278-287)
- import에 `getMaxMultiplier` 추가
- L246: `targetMultiplier={getMaxMultiplier(risk, rows)}`로 교체
- ResizeObserver useEffect 위에 deps 명시 주석 한 줄 추가 (eslint-disable 사유)

### 3. `src/shared/games/plinko/PlinkoRenderer.ts`
- L440-441의 혼란스러운 `// Wait —` 주석을 1줄로 정리:
  `// peg x: matches engine's (cumRight + 0.5) / (row + 2) — same formula.`

## 비-수정 (의도적 거부)

- **peg 변수명 `count` → `pegCount`**: 수식 동일, 가독성 미미, 변경량 대비 가치 없음
- **ResizeObserver 390px 이중 cap**: 부모 컨테이너 책임, Renderer는 받은 size만 신뢰
- **DPR 재구독 / iPhone SE / mode race**: v3 또는 PR-2 (이전 합의)

## 검증

- TS strict GREEN
- low/medium/high × 8/12/16 = 9 조합에서 BetSummary `targetMultiplier`가 실제 최대 슬롯과 일치
- MULTIPLIERS 테이블 한 줄 임의로 키워보면 BetSummary가 자동 반영되는지 확인

## 완료 보고 문구
"v5.1.1 적용: maxMultFor 하드맵 제거 → PlinkoEngine.getMaxMultiplier 단일 소스. 테이블 변경 시 BetSummary 자동 동기화."
