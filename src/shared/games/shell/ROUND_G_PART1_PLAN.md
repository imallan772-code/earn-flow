# 라운드 G-Part1 — 게임 공통 셸 추출

## 1. 목적

6개 신규 게임(Mines·Plinko·Limbo·Wheel·Keno·HiLo)을 화면당 ~150줄로 완성할 기반 추상화. Crash·Dice 동작 회귀 0건 보장.

## 2. 핵심 아키텍처 결정 + 근거

- **createGameStore 팩토리**: `persistedGameState.ts`에 박혀 있던 `createStore`를 외부화. 게임마다 새 스토어를 1줄로 선언. zustand 미도입(번들/일관성/SSR 안전성). 기존 `useSyncExternalStore` 패턴 유지.
- **useGameRound single/multi-step 분리**: Dice·Mines·Limbo·Plinko·Wheel·Keno는 `place → rollFn → resolve → settled → idle` 단일 흐름. Crash·HiLo는 라운드 도중 외부 이벤트(tick/사용자 액션)로 종료 시점이 결정되므로 `isMultiStep=true` + 외부 `settle()` 명시 호출. 한 훅 안에 두 패스를 두되 분기를 명확히 분리해 인지 비용 최소화.
- **GameShell 순수 레이아웃**: 셸이 `StakeBetPanel`/`BetSummaryPanel`을 직접 import하면 단일 진실 출처 위반 + 결합도 폭증. 패널은 ReactNode로 주입받아 게임별 props 자유도 확보(Crash의 `suppressCashoutButton`, Dice의 `compact` 등).
- **phase는 훅 내부 useState, 영속 데이터만 store**: UI 임시 상태가 localStorage에 새거나 새로고침 시 `rolling`이 복원되는 버그 차단.

## 3. 기존 Crash/Dice와의 호환성 전략

- `persistedGameState.ts`의 export 라인·타입·localStorage key(`phonara.gamestate.dice.v1` / `crash.v1`)·initial shape **100% 보존**.
- DiceScreen·CrashScreen 코드 수정 0줄. 기존 사용자의 localStorage 데이터 그대로 로드.
- 마이그레이션 정책: 이 라운드는 추상화만, Crash/Dice는 손대지 않음. Mines를 셸 위에서 1게임 성공시킨 후 **별도 라운드**에서 Crash/Dice를 마이그레이션. 위험 분산.

## 4. Real money 모드에서 Supabase로 옮겨야 할 부분

- **rollFn**: 클라이언트 RNG/PF 대신 Edge Function이 서버 시드·결과 결정. 클라이언트는 결과만 신뢰.
- **잔액·히스토리**: localStorage는 optimistic cache만, 서버가 truth source. 라운드 settle 시 서버 RPC 호출 → 응답으로 store 동기화.
- **liveBet emit**: 서버 측 broadcast(Realtime)로 대체, 봇 데이터 제거.
- 각 파일 상단에 해당 `TODO:` 주석을 못 박아 둠.

## 5. 트레이드오프 / 주의사항

- **단일 훅이 single/multi 모두 처리** → 인터페이스가 약간 부풀음. 대안(훅 2개로 분리)은 호출자 코드 중복을 키워 기각.
- **셸이 LiveBetsFeed를 포함하지 않음** → 무스크롤 보장 위해 의도적. 라우트가 셸 바깥에 피드를 둠(Dice 현재 동작과 동일).
- **`reset()` 신규 추가**: 데모/리얼 모드 전환·디버그용. 호출하지 않으면 기존 동작에 영향 없음.
- **dev key 중복 경고**: HMR 재실행 시 false positive 가능 → `Set` 비교 후 dev 환경에서만 `console.warn`.

## 6. 검증 기준

- 빌드 GREEN, vitest **42/42 GREEN** (기존 38 + 신규 4)
- Dice·Crash 라우트 진입 후 잔액·히스토리·라운드 동작 회귀 0
- localStorage 기존 key 그대로 로드(스키마 호환)
- 390×844 무스크롤 검증은 다음 라운드(Mines 실사용) 시 시각 확인
