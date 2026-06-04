## 라운드 B — Crash 게임 (지존급, 5파트)

Round A 결정론 엔진을 처음으로 실전 투입. Stake.com과 1:1 동등한 Crash를 5개 PR로 잘게 쪼개 구현합니다.

---

### B1. CrashEngine (순수 로직, DOM 0)
산출: `src/shared/games/crash/CrashEngine.ts`
- 라운드 상태머신: `betting(5s)` → `running` → `crashed` → `cooldown(3s)` → 다음 라운드
- 멀티플라이어 공식 (Stake 동등): `m(t) = max(1.00, floor(pow(e, 0.00006 * t) * 100) / 100)` (t=ms)
- `computeCrashPoint(serverSeed, clientSeed, nonce)` — HMAC-SHA256 → 1% 하우스엣지
  ```
  h = HMAC_SHA256(serverSeed, `${clientSeed}:${nonce}`)
  e = int(h.slice(0,13), 16)
  if e % 33 === 0 → 1.00 (instant bust)
  else → floor((100 * 2^52 - e) / (2^52 - e)) / 100
  ```
- 순수 함수만, React 의존 0, Round A `provablyFair.ts` 재사용

### B2. CrashEngine 단위 테스트 (지존급 검증)
산출: `src/shared/games/crash/__tests__/crashEngine.spec.ts`
- **동일 seed → 동일 crashPoint** (결정론 1000회)
- **2.000000x 자동캐시아웃 1000회 → 0프레임 오차** (Round A `reachedTarget` 적용)
- **RTP 99% ± 0.5%** (10,000회 시뮬레이션)
- **1.00x 미만 절대 불가** (최솟값 invariant)
- **commit/reveal 검증** — 사전 hash와 사후 seed가 일치

### B3. CrashCanvas (Canvas 2D, 단일 RAF)
산출: `src/shared/games/crash/CrashCanvas.tsx`
- Round A `tickLoop` 구독 (별도 RAF 금지)
- 그라데이션 곡선 + 격자 + 시간축
- 현재 배수: 거대 폰트, 폭발 시 빨강 flash + screen shake (CSS transform)
- 색상 100% `src/styles.css` 토큰
- DPR 대응 (retina 선명)

### B4. StakeBetPanel (공용 컴포넌트, Manual/Auto)
산출: `src/shared/games/ui/StakeBetPanel.tsx`
- **Manual 탭**: bet amount, 1/2·2x·max 버튼, 자동캐시아웃 입력(2.00), Bet/Cashout 버튼
- **Auto 탭** (Round A `autoBet.ts` 직결):
  - Strategy: Martingale/AntiMartingale/Fibonacci/DAlembert/Flat
  - On Win/Loss: reset | increase by %
  - Stop on profit / Stop on loss
  - Number of bets (0=∞)
  - Start/Stop
- 다른 게임에서도 재사용 가능하게 props로 추상화

### B5. CrashScreen + 라우트 + 히스토리/라이브
산출:
- `src/features/games/crash/CrashScreen.tsx`
- `src/routes/_app/games.crash.tsx` (TanStack 라우트)
- `src/mocks/crashHistory.ts`

구성:
- 상단: 최근 30라운드 chip 히스토리 (<2x 빨강 / 2~10x 노랑 / 10x+ 초록)
- 중앙: CrashCanvas
- 하단 좌: StakeBetPanel
- 하단 우: 라이브 베터 리스트 (mock, 5초마다 갱신)
- 우측 시트: Provably Fair 검증 모달
  - 다음 라운드 serverSeed hash 사전 공개
  - 라운드 종료 후 reveal
  - 사용자 검증 버튼 (직접 HMAC 돌려서 동일 결과 확인)

---

### 라운드 B 게이트 (전부 PASS 필수)
1. vitest 5종 모두 GREEN (특히 2.00 1000회, RTP 99%)
2. Canvas 평균 프레임 < 16.7ms (Round A frame guard로 측정)
3. 색상 토큰 100% (하드코딩 hex 0)
4. 라우트 `/games/crash` 진입 + 게임 동작 확인
5. Provably Fair 모달에서 사용자 직접 검증 성공

### 다음 라운드 예고
- **라운드 C**: Dice (C1 엔진 / C2 테스트 / C3 슬라이더 UI / C4 화면+로비카드)
- **라운드 D**: 게임 로비 + Earn 탭 통합
- **라운드 E**: Slots → Roulette → RPS → LuckyBox → CardFlip → Keepy-Uppy (각 별도 라운드)
- **라운드 F**: 트레이딩 터미널 (Spot / Futures)
- **라운드 G**: 입출금 (USDT/KRW/상품권)
- **라운드 H**: 어드민 잔여 (입금큐/출금큐/유저/STR)

---

**이번 라운드는 B1~B5만 실행** — 6개 파일 + 1개 테스트. Crash 하나에 끝판왕급 시간 투자.
