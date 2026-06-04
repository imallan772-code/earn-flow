# Plinko 안정화 + 전 게임 더블탭 방지 (Round G Part 0.5)

크리티컬 버그 1개 + 공통 보호 1개 + Plinko UX 4개. 한 번에 처리.

---

## 1. 🔴 CRITICAL: Plinko crash 수정 (`Cannot read 'x' of undefined`)

**증상**: `interpolateSample` 호출 시 `samples[i]`가 undefined → `a.x` 크래시. 빠른 연속 클릭 시 재현됨.

### 1-A. PlinkoRenderer 방어 가드 (근본 대비)
- `interpolateSample` 진입 시 `a`/`b` undefined 검사 → null 반환
- `frame` / 트레일 루프에서 null 결과를 안전하게 스킵
- `playDrop` 진입 시 기존 rAF 명시적 cancel + cursor/playStart/landedFor 원자적 리셋 (정확한 race 경로 차단)

### 1-B. PlinkoBoard 동기 락 (race 차단)
- `placingRef = useRef(false)` 도입
- `handlePlace`: 진입 즉시 `if (placingRef.current) return; placingRef.current = true;`
- `onLand` 또는 settle 종료 시 `placingRef.current = false`

---

## 2. 전 게임 더블탭 방지 (StakeBetPanel 단일 지점)

**원인**: `canPlace`가 React state 기반(async). 같은 tick의 연속 탭이 둘 다 stale `true`를 봄.

### `src/shared/games/ui/StakeBetPanel.tsx`
- Manual `베팅` 버튼에 동기 `placingRef` 추가
- onClick 진입 시 ref true → `onPlace` 호출 → 400ms 후 또는 `canPlace`가 false→true 천이 감지 시 release
- Auto-bet 루프(useEffect)는 이미 단일 천이 가드(`canPlaceRef`)가 있으므로 추가 변경 없음
- 한 곳만 고치면 Crash/Dice/Plinko 전부 동시에 보호됨

---

## 3. Plinko 자동베팅 활성화

### `src/shared/games/plinko/PlinkoBoard.tsx`
- StakeBetPanel `variant="compact"` 제거 → Manual/Auto 탭 노출
- `showAutoTarget={false}` 유지 (Plinko는 즉시 결과, auto-cashout 타겟 무의미)
- `lastOutcome` 전달은 이미 되어 있어 auto-bet reducer 정상 동작
- Auto 진행 중에는 rows/risk 변경 disabled (기존 `phase !== "idle"` 가드와 동일)

---

## 4. 배율 라벨 크기 키우기

### `src/shared/games/plinko/PlinkoRenderer.ts`
- L108 `slotH = 32` → `40`
- L472 폰트 사이즈 식 `Math.max(8, Math.min(11, sw * 0.32))` → `Math.max(10, Math.min(15, sw * 0.42))`
- 16줄(17 슬롯) 케이스도 가독성 확보 (390px 기준 슬롯 폭 ≈ 22px → 폰트 ≈ 9.2px 최소 보장)
- canvas 캡: `max-h-[min(420px, calc(100dvh-260px))]` → slotH +8 반영해서 여유 유지

---

## 5. Plinko 게임 설명 + 6. 라이브 베팅 피드 + 7. 레이아웃 재구성

PlinkoBoard는 캔버스+컨트롤+베팅 패널까지만 담당. 헤더/규칙/피드는 PlinkoScreen이 컴포지션.

### 5. `src/shared/games/rules/gameRules.ts`
- `PLINKO_RULES` 추가 (5섹션: 기본 규칙 / 줄 수 & 리스크 / 배당 계산 / 데모 vs 리얼 / Provably Fair)
- `RULES_BY_GAME.plinko = PLINKO_RULES`

### 6. `src/shared/livefeed/LiveBetsStore.ts`
- `LiveGame` union에 `"plinko"` 추가
- `seedInitialBets`/`botGenerator`도 plinko 비중 살짝 추가 (1개 가중치)

### 6. PlinkoBoard onLand에서 `liveBetsStore.push`
- Dice/Crash 패턴 따라 user/amount/multiplier/profit/status/mode/isMe 채워서 push

### 7. `src/features/games/plinko/PlinkoScreen.tsx` 재작성
구조:
```
<div className="flex flex-col gap-2">
  <header>← / Plinko / ModeBadge / #nonce / 공정성</header>
  <GameRulesCard rules={PLINKO_RULES} onVerify={...} />
  <PlinkoBoard mode={mode} />       ← 캔버스 + controls + bet panel (canvas h 고정)
  <LiveBetsFeed game="plinko" limit={10} />
  {showFair && <FairnessModal/>}
</div>
```

### PlinkoBoard 레이아웃 변경
- `h-[100dvh]` 제거. 일반 flow.
- 헤더(L151-168)와 백버튼 제거 (Screen에서 처리)
- 잔액 표시는 컨트롤 영역으로 이동하거나 StakeBetPanel 자체에 노출되므로 제거 가능
- canvas wrap: `h-[420px]` 또는 `aspect-[9/14]` 고정 (스크롤 가능 페이지)
- 나머지 controls/summary/bet panel 그대로

---

## 강제 규칙
- `PlinkoEngine.ts` / `persistedGameState.ts` 수정 금지
- `StakeBetPanel` 수정은 더블탭 ref 1개만. 기존 props 시그니처 불변
- `routeTree.gen.ts` 수동 편집 금지
- 더블탭 ref는 unmount cleanup 불필요 (ref 자체 GC)
- Plinko 잔액은 임시 useState 유지 (Round G Part 1까지)

## 검증
- 베팅 버튼 5회 연타 → 1회만 실행, 콘솔 에러 0
- Crash/Dice/Plinko 모두 동일하게 더블탭 차단
- Plinko Auto 탭 보임 + 횟수/on-loss/on-win 동작
- 슬롯 배율 라벨 16줄에서도 읽힘 (390px 기준)
- `/games/plinko` 진입 시 헤더-규칙-캔버스-컨트롤-피드 순으로 스크롤 가능
- 라이브 피드에 플링코 베팅 표시됨
- TS strict GREEN

## 완료 보고
"Plinko 크래시 수정(interpolateSample 가드 + handlePlace 동기 락), 전 게임 더블탭 방지(StakeBetPanel 단일 가드), Plinko 자동베팅/규칙/라이브피드/배율 가독성 개선 완료."
