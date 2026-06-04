# 라운드 F: Crash 버튼 통일 + Dice 정통 Stake 화 + 화면 이동 시 상태 유지

## 0. 긴급 — Dice3D 즉시 대체 (승인 후 1순위)

plan 모드 진입 전 `src/shared/games/dice/Dice3D.tsx`가 이미 삭제됨. 빌드 모드 전환 즉시:
- 신규 `DiceResultDisplay.tsx` 생성 (아래 §2)
- `DiceScreen.tsx`에서 `Dice3D` 임포트 → `DiceResultDisplay`로 교체

## 1. Crash — 캐쉬아웃 버튼 1개로 통일

라이브 라운드 중 노란 버튼이 상단 BetSummaryPanel + 하단 StakeBetPanel에 동시에 보임.

- `StakeBetPanel.tsx`에 신규 prop `suppressCashoutButton?: boolean`
  - true 시 `hasActiveBet`이어도 노란 캐쉬아웃 렌더하지 않고, 비활성 회색 "라운드 진행 중 — 위에서 캐쉬아웃" 표시
- `CrashScreen.tsx`: `<StakeBetPanel suppressCashoutButton />` 전달
- 캐쉬아웃은 `BetSummaryPanel`의 내장 버튼이 유일한 진입점

## 2. Dice — 3D 큐브 완전 제거, Stake/Roobet 정통 결과 패널

큰 숫자(0~99.99)와 1~6면 큐브가 의미상 불일치 → 큐브 완전 제거.

- 신규 `src/shared/games/dice/DiceResultDisplay.tsx`
  - 좌측: 큰 결과 숫자(64px), rolling 시 셔플
  - 우측: 배수 / 목표(OVER·UNDER) / 승률 3행
  - 승/패 시 숫자 컬러 펄스, loss 시 패널 흔들림
  - 높이 140px 고정 (기존 큐브 컨테이너보다 컴팩트)
- `Dice3D.tsx` 삭제 (이미 완료)

## 3. Dice — 타이머 완전 제거 (즉시 굴림)

- `DiceScreen.tsx`
  - `BETTING_MS`, `bettingMsLeft`, 베팅 카운트다운 useEffect 전부 삭제
  - phase 타입: `"idle" | "rolling" | "settled"` (betting 제거)
  - 베팅 클릭 → 즉시 `setPhase("rolling")` → 결과 → `SETTLED_MS=800ms` → `idle` 복귀(=상시 베팅 가능)
  - `StakeBetPanel` props: `canPlace={phase==="idle" && !activeBet}`, `bettingProgress={undefined}`
- `gameRules.ts` DICE_RULES "기본 규칙"에 "즉시 굴려집니다(대기 타이머 없음)" 추가

## 4. Dice — 스크롤 없이 한 화면에 베팅 버튼 노출 (390×844)

- `StakeBetPanel.tsx`에 신규 prop:
  - `variant?: "full" | "compact"` — compact 시 자동탭/자동HUD 숨김, 자동캐쉬아웃 필드 숨김
  - `showAutoTarget?: boolean` (기본 true) — Dice는 false
- Dice 화면 수직 순서 재배치:
  1. 헤더 56px
  2. 룰 카드(접힘) 48px
  3. 히스토리 스트립 32px
  4. `DiceResultDisplay` 140px
  5. `DiceSlider` (글래스 박스, 패딩 축소) 130px
  6. `BetSummaryPanel`(static, 컴팩트) 80px
  7. `StakeBetPanel variant="compact"` (수동 + 베팅버튼) 130px
  - 총 ≈ 616px < 844px → 베팅 버튼 첫 뷰포트 노출
- 라이브 피드는 스크롤 시 노출

## 5. 화면 이동해도 결과·잔액·히스토리 유지 (Stake/Roobet 식)

- 신규 `src/shared/games/state/persistedGameState.ts`
  - 의존성 0 (zustand 안 씀). `useSyncExternalStore` + localStorage + 50ms 디바운스 flush
  - 스토어 2개:
    - `diceStore`: `{ balance, nonce, history, lastRoll, lastOutcome, target, diceMode, pendingAmount }`
    - `crashStore`: `{ balance, nonce, history, lastOutcome, pendingAmount, pendingTarget }`
  - 키: `phonara.gamestate.dice.v1` / `phonara.gamestate.crash.v1`
- `DiceScreen.tsx` / `CrashScreen.tsx`
  - 위 7~8개 state를 `useState` → `store.use(s => s.X)` + `store.set(...)`로 전환
  - phase, activeBet, bettingMsLeft 등 일시적 라운드 진행 상태는 그대로 useState (메모리만)
  - 결과 표시·잔액·히스토리는 모두 store에서 읽음 → 화면 나갔다 돌아와도 마지막 결과/잔액/히스토리/슬라이더 위치 그대로
- Crash 화면 unmount 시 활성 베팅(아직 캐쉬아웃 안 됨)은 자동으로 베팅액 환불 처리(`return () => { if (bet && bet.cashedAt==null) crashStore.set(s=>({...s,balance:s.balance+bet.amount})) }`) — 잔액 손실 방지

## 변경 파일

**생성 (2):** `state/persistedGameState.ts`, `dice/DiceResultDisplay.tsx`
**수정 (4):** `CrashScreen.tsx`, `DiceScreen.tsx`, `StakeBetPanel.tsx`, `gameRules.ts`
**삭제 (1):** `dice/Dice3D.tsx` (이미 삭제됨)

## 검증

- 390×844 Dice 진입: 스크롤 0, 베팅 버튼 즉시 보임
- Dice 베팅 클릭: 즉시 굴림(타이머 X), 결과 숫자가 슬라이더 마커와 같은 값
- Crash 라운드 중 캐쉬아웃 버튼은 상단 1개만 활성
- Dice/Crash 화면 → 홈/다른 게임 → 다시 진입: 잔액·히스토리·마지막 결과·슬라이더 위치 100% 보존
- 브라우저 새로고침 후에도 동일 (localStorage)
- 기존 vitest 38/38 GREEN 유지