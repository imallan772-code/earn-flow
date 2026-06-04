# 다음 작업 — 잘게 나눈 파트 진행 로드맵

견고함이 필요한 영역(결정론 엔진, Stake 1:1 게임, 트레이딩 터미널)은 **작은 PR 단위**로 끊어 들어갑니다. 이번 라운드는 **A 파트만** 실행. B/C/D는 각각 별도 라운드에서 확인 후 진행.

---

## 라운드 A — 결정론 엔진 코어 (이번 라운드)

게임 전체의 기반. 게임을 만들기 전에 엔진부터 박는다.

### A1. RNG & Provably Fair 유틸 (단독 PR)
산출: `src/shared/games/engine/rng.ts`
- `mulberry32(seed: number)` — 32-bit 결정론 PRNG
- `xorshift32(seed: number)` — 검증용 보조 PRNG
- `hashStringToSeed(s: string)` — FNV-1a 32-bit
- `sha256Hex(input: string)` — Web Crypto async wrapper
- 모든 함수 순수 · 부수효과 0

### A2. Provably Fair (단독 PR)
산출: `src/shared/games/engine/provablyFair.ts`
- Stake.com 방식: `serverSeed` + `clientSeed` + `nonce` + `cursor`
- `commitServerSeed(serverSeed)` → SHA256 hash 사전 공개
- `revealServerSeed(serverSeed)` → 라운드 후 검증
- `bytesGenerator(serverSeed, clientSeed, nonce, cursor)` — HMAC-SHA256 스트림
- `floatFromBytes(bytes)` — 4바이트 → [0,1) 균등분포

### A3. 정확도 유틸 + 단위테스트 (단독 PR)
산출: `src/shared/games/engine/clamp.ts` + `__tests__/clamp.spec.ts`
- `quantize6(v: number)` — `Math.floor(v * 1e6) / 1e6`
- `reachedTarget(actual: number, target: number)` — `actual >= target - 1e-9`
- `formatMultiplier(v: number, digits = 2)` — 표시용
- 테스트: 2.000000 target에 대해 `[1.999999..., 2.0, 2.000001]` 케이스 3종 검증

### A4. 자동베팅 상태기계 (단독 PR)
산출: `src/shared/games/engine/autoBet.ts` + `__tests__/autoBet.spec.ts`
- 전략: `Martingale` · `AntiMartingale` · `Fibonacci` · `DAlembert` · `Flat`
- 옵션: `baseBet` · `numberOfBets`(0=무한) · `onWin{ reset|increase% }` · `onLoss{ reset|increase% }` · `stopOnProfit` · `stopOnLoss`
- 순수 reducer: `step(state, outcome) => nextState`
- 테스트: Martingale 5연패 시 베팅 정확히 32배 검증

### A5. 단일 RAF 마스터 루프 + 프레임 가드 (단독 PR)
산출: `src/shared/games/engine/tickLoop.ts`
- `createTickLoop({ onTick(dtMs) })` — 단일 RAF · 자동 시작/정지
- `subscribe(fn)` — 여러 게임이 동일 루프 공유 (Canvas 한 화면에 1개 RAF 보장)
- 16ms+ 프레임 감지 → dev 환경 `console.warn` (prod 무음)

### 라운드 A 게이트
- 모든 유닛테스트 PASS
- 엔진 코드는 React/DOM 의존 0 (pure TS)
- 다음 라운드(B)부터 엔진을 import해서 Crash 구현

---

## 다음 라운드 예고 (확인 후 진행)

### 라운드 B — Crash 게임
- B1. `CrashEngine.ts` (성장식 + bust point 결정론)
- B2. `<StakeBetPanel>` 공용 컴포넌트
- B3. `CrashCanvas.tsx` (Canvas 2D 단일 RAF)
- B4. `CrashScreen.tsx` + 라우트
- B5. `2.000000` 자동캐쉬아웃 1000회 시드검증 테스트

### 라운드 C — Dice 게임
- C1. `DiceEngine.ts` (1% 엣지)
- C2. `DiceScreen.tsx` 슬라이더 + Over/Under
- C3. Provably fair 영수증 다운로드
- C4. 라우트 + 게임 로비 카드

### 라운드 D — 나머지 6게임 (각 게임 별도 라운드)
Slots / Roulette / RPS / LuckyBox / CardFlip / Keepy-Uppy

### 라운드 E — 트레이딩 터미널 (Spot / Futures 각 별도)
### 라운드 F — 입출금 (USDT / KRW / 상품권 각 별도)
### 라운드 G — 어드민 나머지 페이지 (입금큐 / 출금큐 / 유저 / STR...)

---

**이번 라운드는 A1~A5만 실행** — 약 5개 파일 + 2개 테스트. 견고한 기반 먼저.
