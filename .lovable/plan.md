# persistedGameState.ts 정리 플랜

## 수정 파일 (1개만)
- `src/shared/games/state/persistedGameState.ts`

## 보존 (절대 변경 금지)
- export 8개: `diceStore`, `crashStore`, `DiceRoll`, `DiceOutcome`, `DicePersisted`, `CrashHistoryItem`, `CrashOutcome`, `CrashPersisted` (이름/타입/위치 동일)
- localStorage key: `phonara.gamestate.dice.v1`, `phonara.gamestate.crash.v1`
- 초기값 shape 그대로
- 머지 규칙 `{ ...initial, ...JSON.parse(raw) }`
- 80ms debounce flush, listener 통지, SSR 가드

## 변경 내용

### 1. 파일 헤더 보강
역할(useSyncExternalStore + localStorage, no deps, SSR-safe), 결정 이유, Round G Part 1 마이그레이션 방향 명시.

### 2. createStore 내부 헬퍼 분리 (동작 불변)
- `hydrate<T extends object>(storageKey, initial)`: SSR-safe 초기 로드 (`window` 가드 + try/catch + `{ ...initial, ...parsed }`)
- `createDebouncedFlusher<T>(storageKey, getState, delay = 80)`: 80ms debounce flush 스케줄러 반환 (`{ schedule() }`)
- `set` / `subscribe` / `use`는 기존 로직 그대로
- 타이머 변수 타입을 `ReturnType<typeof setTimeout> | null`로 명시 (브라우저/SSR 환경별 setTimeout 반환 타입 차이 흡수 — 짧은 주석으로 설명). `window.setTimeout` 호출 형태 유지.

### 3. createStore 위 TODO (정확히 삽입)
```
// TODO(Round G Part 1): 이 createStore를 src/shared/games/shell/createGameStore.ts
// 팩토리로 추출. 본 파일은 diceStore/crashStore 두 export만 유지하고
// factory import로 교체 예정. 외부 시그니처/localStorage key는 불변.
```

### 4. 섹션 구분 주석
- DICE 블록 위: "Dice 게임 잔액/nonce/히스토리/마지막 결과/타깃·모드/대기 베팅 보존. `src/features/games/dice/DiceScreen.tsx`에서 사용."
- CRASH 블록 위: "Crash 게임 잔액/nonce/히스토리/마지막 결과/대기 베팅/대기 자동캐쉬아웃 보존. `src/features/games/crash/CrashScreen.tsx`에서 사용."

### 5. Real money TODO (각 store 정의 위에)
```
// TODO: Real money 모드에서는 balance/history/nonce를 Supabase로 이관.
// localStorage는 optimistic cache로만 사용하고, settle은 Edge Function RPC로 위임.
```

## 하지 않을 것
- 인터페이스 필드/이름/타입 변경
- 초기값 변경
- key·debounce·머지 동작 변경
- export 추가/삭제
- `createGameStore` 실제 추출 (Part 1 본작업)
- 의존성 추가

## 검증
- export diff: 8개 심볼 위치/이름/타입 동일
- 빌드 GREEN, 기존 vitest GREEN
- Dice/Crash 라우트 새로고침 → 기존 localStorage 데이터 정상 로드

## 완료 보고
> "persistedGameState.ts 정리 작업이 완료되었습니다. 기존 동작은 100% 유지되었습니다."
