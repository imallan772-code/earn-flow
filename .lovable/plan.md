# 최종 P1 플랜 (승인본)

Crash·Dice 회귀 0 + GameShell 추상화 실구현 + Mines 1종(multi-step)으로 검증 + vitest 게이트 정상화.

---

## 작업 순서 (엄격)

### 0. 사전 게이트 — 테스트 인프라 신규 생성

- `package.json`: `"test": "vitest run"`, `"test:watch": "vitest"` 추가
- **`vitest.config.ts` 신규 생성** (`environment: 'jsdom'`, `setupFiles: ['./src/test/setup.ts']`, alias `@`)
- **`src/test/setup.ts` 신규 생성** (`@testing-library/jest-dom`, localStorage cleanup)
- 의존성 추가: `@testing-library/react`, `@testing-library/jest-dom`, `jsdom`
- 베이스라인: `bunx vitest run` — 기존 5 spec 파일 전체(~38 tests) GREEN, `bunx eslint . --max-warnings=0` GREEN

### 1. 게임 셸 추출 (`src/shared/games/shell/`)

신규:

- `createGameStore.ts` — `persistedGameState.ts` L76~108 `createStore`를 외부화. `Store<T>`·80ms debounce·`useSyncExternalStore`·hydrate 머지 100% 보존. dice/crash의 use/set/get 시그니처·**v2 localStorage key 불변**.
- `useGameRound.ts` — single-step + **multi-step (`isMultiStep=true`, 외부 `settle()`)** 분기. `phase`는 훅 내부 `useState`, 영속 데이터만 store.
- `GameShell.tsx` — 순수 레이아웃. `betPanel`/`displayArea`/`summaryPanel`/`rulesCard` ReactNode 주입. 비즈 로직 0.
- `__tests__/createGameStore.spec.ts` (3 케이스)
- `__tests__/useGameRound.spec.ts` (4 케이스: single happy/loss, multi settle, reset)

수정:

- `src/shared/games/state/persistedGameState.ts` — 내부 `createStore` 제거, `createGameStore` import 교체. **export·key·initial shape 불변. Dice/Crash Screen 0줄 수정.**

### 2. Mines 1종 (multi-step)

**`useGameRound({ isMultiStep: true })` 사용.** 베팅 시 PF로 전체 지뢰 배치 확정, reveal은 엔진 순수함수, cashout/mine-hit 시 `settle()`.

신규:

- `src/shared/games/mines/MinesEngine.ts` — 5×5, 지뢰 1~24, `placeMines(pf, mineCount)`, `nextMultiplier(revealed, mines)`, RTP 99% + `houseEdge.profitOf` (이중 구조 주석 명시, `bytesGenerator` 재사용)
- `src/shared/games/mines/__tests__/minesEngine.spec.ts` (6 케이스)
- `src/features/games/mines/MinesScreen.tsx` — GameShell + StakeBetPanel + BetSummaryPanel. **120~180줄.** LiveBetsFeed는 **GameShell 바깥**(DiceScreen 패턴). `liveBetsStore.push` (베팅) / `update` (cashout·hit) 연동. **Provably Fair 모달**(ShieldCheck + commit hash + seeds, Dice/Crash와 동일 UX).
- `src/routes/_app/games.mines.tsx` — `createFileRoute("/_app/games/mines")`

수정:

- `persistedGameState.ts` — `minesStore = createGameStore("mines", {...}, 1)` 추가. shape: `{ nonce, history, lastOutcome, mineCount: 3, pendingAmount }`
- `src/shared/games/rules/gameRules.ts` — `MINES_RULES` + `RULES_BY_GAME` 등록
- `src/features/games/GameLobby.tsx` — `GameId` union `"mines"` 추가, GameTile Link 분기, Mines 카드 1개 추가 (아이콘 자율: Bomb/Grid3x3)
- `package.json` — test 스크립트 + devDeps
- `LiveBetsStore.ts` — `"mines"` 타입 이미 존재, 작업 불필요

### 3. 검증 게이트 (전부 GREEN)

- `bunx eslint . --max-warnings=0`
- `bunx vitest run` — 기존 ~38 + 신규 13 = **최소 51 tests GREEN**
- `bun run build` GREEN
- Crash·Dice 수동 회귀: nonce·히스토리·잔액·새로고침 복원
- Mines 수동: 베팅→reveal 반복→cashout/hit settle→새로고침 복원(nonce/history/mineCount)

---

## 비대상 (이번 라운드 안 함)

Limbo/HiLo/Wheel/Keno/Roulette, Live Feed 개편, botGenerator RAF, Race/Drops/Raffle, walletStore xp/vip/rakeback, Bet Slip/Hotkey/Sound/Haptic, Web Worker PF, react-window, Plinko 정렬.

## 규칙

LOVABLE_WORK_RULES §3(zustand 금지)/§5(셸 순수)/§6(금전 보수)/§7(파일 상단 주석+`TODO:`)/§8(컴포넌트 비즈 금지) + ROUND_G_PART1_PLAN.md 준수.

## 영향 파일 (신규 11, 수정 5)

**신규 11:** `vitest.config.ts`, `src/test/setup.ts`, `shell/createGameStore.ts`, `shell/useGameRound.ts`, `shell/GameShell.tsx`, `shell/__tests__/createGameStore.spec.ts`, `shell/__tests__/useGameRound.spec.ts`, `mines/MinesEngine.ts`, `mines/__tests__/minesEngine.spec.ts`, `features/games/mines/MinesScreen.tsx`, `routes/_app/games.mines.tsx`

**수정 5:** `package.json`, `persistedGameState.ts`, `gameRules.ts`, `GameLobby.tsx`, (+ 필요 시 `ROUND_G_PART1_PLAN.md` 문서의 Mines single→multi 정정은 다음 라운드)

## 다음 라운드 보관 결정

- Race 단위: **PHON** · 사운드 기본 **OFF + 토글** (`localStorage.phonara.audio.enabled`)
