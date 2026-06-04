# Round D — Crash / Dice 지존급 리디자인 + 오토베팅 수정

## 목표
- Crash·Dice 화면을 Stake/Roobet 톱티어 수준으로 격상 (시네마틱 캔버스, 명확한 정보 위계, 진중한 게임룸 톤)
- StakeBetPanel 자동베팅이 다음 라운드에 자동 발사되지 않는 버그 수정
- 토큰만 사용 — `oklch` 변수 외 raw 컬러 금지, 영문/한글 혼용 정리 (UI 라벨은 한글, 숫자/배수는 mono)

---

## 1. CrashScreen 리디자인

### 레이아웃 (390×844 기준, 위→아래)
```text
┌────────────────────────────────────────┐
│ ← Crash    [라운드 #1284]   [공정성 🛡]│  ← 슬림 헤더 (h-12)
├────────────────────────────────────────┤
│ 1.24x 2.10x ▌7.42x ▌1.01x ...          │  ← 히스토리 chip rail (가로 스크롤, 더 큰 폰트)
├────────────────────────────────────────┤
│                                        │
│            ✦  12.47x  ✦                │  ← 캔버스 (aspect 5/4)
│         ━━━━━━━━━━━━━━━━━              │     • 곡선 + glow trail
│       ━━━                              │     • 좌상단: 베팅 칩 (글래스)
│   ━━━                                  │     • 우상단: 잠재수익 라이브 (배수×베팅)
│ ━━                                     │     • 베팅 단계: 거대 카운트다운 링
│                                        │     • 크래시: 풀 스크린 빨간 플래시 + shake
├────────────────────────────────────────┤
│ [수동][자동]            잔액 1,000 USDT │
│ ┌────────────────────────────────────┐ │
│ │ 베팅액  [10.00]  ½  2x  MAX        │ │
│ │ 자동캐쉬아웃 [2.00x]  +0.10 -0.10  │ │
│ │ ────────────────────────────────── │ │
│ │    [   베팅하기 (다음 라운드)   ]   │ │  ← 진행바 wrap (5s 카운트다운 시각화)
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│ 라이브 베팅 (24명 · 12,430 USDT)       │  ← 헤더 + 합계
│ avatar 유저  ▌베팅  ▌배수  ▌수익      │  ← 행 hover, win pulse 애니메이션
└────────────────────────────────────────┘
```

### 캔버스 업그레이드 (`CrashCanvas.tsx`)
- 다층 그라데이션 fill (시안 → 투명, 크래시는 로즈)
- 곡선 위 별 파티클 4~6개 (배수 증가에 따라 위로 흐름)
- 12개 가로 grid + 6개 세로 grid, 라벨링 (1x, 2x, 5x, 10x …)
- 베팅 단계: 중앙에 SVG 카운트다운 링 + 거대 숫자
- 크래시 시: 0.6s ease-out scale + opacity flash, "BUSTED @ X.XXx" 큰 stamp
- DPR 캐싱 그대로, sharedTickLoop 한 줄 RAF 규칙 준수

### 카드 / 칩 디테일
- 히스토리 칩: w-12 h-7, 색상 3단계 (≤2x rose / ≤10x gold / >10x emerald), bg 22% mix
- 라운드 번호 chip 헤더에 추가 (`#${nonce.toString().padStart(4,"0")}`)
- 라이브베팅 행: avatar (initial+gradient), 캐쉬아웃 시 행 emerald glow 0.8s

### 베팅 단계 진행바
- "베팅하기" 버튼 내부에 `bettingMsLeft / BETTING_MS` 가로 진행바 fill (cyan→투명)
- 0이 되면 버튼 비활성 + "다음 라운드 대기"

---

## 2. DiceScreen 리디자인

### 레이아웃
```text
┌────────────────────────────────────────┐
│ ← Dice    [#412]    [공정성 🛡]        │
├────────────────────────────────────────┤
│  72.41    72.41    33.10    91.22 ...  │  ← 더 큰 히스토리 칩
├────────────────────────────────────────┤
│                                        │
│            72.41                       │  ← 결과 디스플레이 (aspect 5/4)
│        ━━━━━━━━━━━━━━━                 │     • 거대 숫자 + 윈/루즈 컬러
│         🎲 WIN +24.50                  │     • 결과 아래 결과 칩
├────────────────────────────────────────┤
│  Under ━━━━━━╿━━━━━━━━ Over            │  ← 슬라이더 (12px 트랙, glow thumb)
│       0           50.00          99.99 │
│  [멀티 2.00x] [목표 50.00] [확률 49.5%]│  ← 3-칸 stat carde, 큰 numeric
├────────────────────────────────────────┤
│ [수동][자동]            잔액 1,000     │
│ … (StakeBetPanel)                      │
└────────────────────────────────────────┘
```

### 슬라이더 업그레이드 (`DiceSlider.tsx`)
- 트랙 h-3 → h-4, 라운드 풀, 좌우 라벨 (0/50/99.99)
- thumb 28×28, 시안 outer ring + glow_purple 그림자, drag 시 scale 1.1
- 마지막 roll marker: 7px 너비 + 8px glow + 0.4s pop-in
- 슬라이더 양쪽 끝 1·99 클릭 가능한 +/- 미세조정 버튼

### 결과 디스플레이
- WIN: emerald glow + 위에서 떠오르는 +XX.XX text (RewardBurst 재사용)
- LOSS: rose ring + 좌우 shake 0.4s
- 결과 칩: 라운드 사이엔 비활성 표시 ("준비 중")

---

## 3. StakeBetPanel — 자동베팅 타이밍 수정

### 현재 버그
다음 effect가 매 렌더마다 실행 시도하지만, `autoStateRef.current.currentBet` 업데이트가 ref라서 React가 리렌더를 트리거하지 않음 → cooldown→betting 전환 시 `canPlace` flip 한 번만 의존성 fire → 그 시점에 stale currentBet 사용 가능.

```ts
useEffect(() => {
  if (!autoRunning || !canPlace || hasActiveBet) return;
  onPlace(autoStateRef.current.currentBet, target);
}, [autoRunning, canPlace, hasActiveBet, onPlace, target]);
```

또한 `onPlace`가 매 렌더 새 함수면 effect가 매번 fire되어 중복 베팅 가능.

### 수정
- `currentBet`을 ref가 아닌 state로 승격 (`[currentBet, setCurrentBet]`)
- 자동 시작/스텝 시 setCurrentBet 호출 → React 렌더 동기화
- 베팅 발사 effect를 `canPlace` rising-edge로 가드 (직전 값 ref로 추적)
- 중복 발사 방지: 한 라운드당 1회 플래그 (`placedNonceRef`)
- 부모의 `onPlace`/`onCashout`는 useCallback으로 안정화 권장 (`CrashScreen`, `DiceScreen` 이미 useCallback 사용 — 확인만)
- 자동 정지 시 ref·state 모두 reset

### 추가 UX
- 자동 모드일 때 패널 상단에 "AUTO · 남은 베팅: ∞ / 누적 손익: +12.50" 미니 HUD
- "자동 시작" 누르면 다음 betting phase 시작 시점에 첫 베팅 자동 실행 (현재도 의도지만 안정화)

---

## 4. 토큰 / 모션 가드

- 모든 색상은 `var(--color-*)` 또는 `color-mix(in oklab, ...)` 만 사용
- 새 애니메이션: `tailwind.config`엔 손대지 않고 styles.css `@layer utilities`에 keyframe 3개 추가
  - `crash-shake` (0.4s), `crash-flash` (0.6s), `result-pop` (0.3s scale-in)
- `framer-motion` 가능 시 사용; canvas 내부 애니는 기존 sharedTickLoop만

---

## 5. 영향 파일 (변경/생성)

수정:
- `src/features/games/crash/CrashScreen.tsx` — 레이아웃·헤더·라이브베팅 카드 재구성
- `src/features/games/dice/DiceScreen.tsx` — 결과 디스플레이 + 헤더 재구성
- `src/shared/games/crash/CrashCanvas.tsx` — 그래디언트·파티클·카운트다운 링
- `src/shared/games/dice/DiceSlider.tsx` — 트랙·thumb·라벨·marker
- `src/shared/games/ui/StakeBetPanel.tsx` — currentBet state 화 + edge-trigger + AUTO HUD
- `src/styles.css` — keyframes 3개 추가

생성:
- 없음 (기존 컴포넌트 강화 우선, 중복 금지 원칙)

삭제:
- 없음

## 6. 검증
- 33/33 vitest GREEN 유지 (엔진은 미변경)
- `tsc` clean
- 390×844 시각 검증: 헤더+캔버스+패널이 첫 스크롤 없이 노출되는지
- 자동베팅: 30초간 3라운드 연속 발사 확인 (수동 콘솔로그)
- 토큰 사용: `rg "text-white|bg-black|#[0-9a-f]{6}"` 0건

승인 시 진행하겠습니다. 아니면 캔버스/결과 디스플레이만 design directions로 3개 시안 먼저 뽑는 것도 가능 — 어느 쪽으로 갈까요?
