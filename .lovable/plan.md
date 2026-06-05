## 작업 계획 (3건)

### 1) `src/shared/layout/LiveCashoutStrip.tsx` — 실시간 캐시아웃 라벨 단위 변경
- 현재: `실시간 캐시아웃 · 5,290,000원 완료!`
- 변경: `실시간 캐시아웃 · {PHON 금액} PHON / {USDT 금액} USDT 완료!`
- 두 개의 `LiveNumber`를 한 줄에 배치 (자연스럽게 ↑↓ 미세 변동 유지)
  - PHON: `base=5_290_000, amplitudeRatio=0.015, bias=0.5, intervalMs=3000`, format `{KO.format(round(n))} PHON`
  - USDT: `base=3_950, amplitudeRatio=0.02, bias=0.5, intervalMs=3500`, format `{n.toFixed(2)} USDT`
- `src/mocks/fomo.ts`에 `MOCK_REALTIME_CASHOUT_USDT = 3_950` 추가 (PHON 상수는 기존 재사용)

### 2) `src/features/landing/Landing.tsx` — 통화 표기 통일
- 본문 `"...KRW/USDE로 인출합니다..."` → `"...KRW/USDT로 인출합니다..."`
- 그 외 `USDE` 잔존 표기 grep으로 일괄 `USDT`로 정정 (Landing, 그리고 발견되는 다른 파일 모두)

### 3) 전체 ESLint = 0 + 렉 제거 (stake.com / rollbit 수준 부드러움)

#### 3-A. ESLint 0건 만들기
- `bunx eslint . --max-warnings=0`로 현재 에러/경고 전수 조사
- 카테고리별 일괄 수정:
  - `@typescript-eslint/no-unused-vars`, `no-empty`, `prefer-const` 등 단순 정리
  - `react-hooks/exhaustive-deps` 누락 디펜던시 보강 (의도적 무시는 주석 + eslint-disable-next-line)
  - `react-refresh/only-export-components` 위반 파일은 export 분리
- 룰 약화 금지 — 코드 수정으로 0건 달성

#### 3-B. 렉 원인 제거 (현재 화면 기준 핫스팟)
체감 렉의 주범은 동시 다발 jitter 타이머 + 매 tick마다 전역 re-render. 다음을 적용:

1. **타이머 통합 (가장 큰 효과)**
   - `LiveNumber` 컴포넌트마다 개별 `setTimeout` 루프 → 단일 `requestAnimationFrame` 기반 글로벌 스케줄러 (`src/shared/motion/liveTickScheduler.ts` 신규)로 일원화. 모든 LiveNumber/`liveOnlineStore` 인스턴스가 동일 프레임에 묶여 갱신.
   - `setTimeout` 폭주 제거 → CPU/GC 압력 감소.

2. **CountUp 보간 비용 절감**
   - `CountUp` 매 프레임 `setState` → `useRef` + 직접 DOM 텍스트 갱신(`ref.current.textContent`)으로 전환. React 리렌더 0회.
   - `prefers-reduced-motion` 외에 `document.hidden`일 때도 RAF 중단.

3. **Marquee/Strip 무한 스크롤 GPU 가속**
   - `animate-marquee` 키프레임을 `transform: translate3d(...)`로 강제, `will-change: transform`, 컨테이너에 `contain: layout paint style`, `content-visibility: auto` 적용.
   - `LiveCashoutStrip`과 `FomoMarquee` 모두 동일 처리.

4. **FloatingOrbs / 그라데이션 비용 절감**
   - `FloatingOrbs`의 blur+animate를 `will-change: transform, opacity`로 한정, 모바일(`max-width: 480px`)에서 orb 수 절반으로 자동 감소.
   - 큰 `backdrop-filter`/`blur(>40px)` 사용처를 `glass-1`/`glass-2` 토큰으로 통일하고 blur 반경을 24px로 캡.

5. **메모이즈 & 리스트 안정화**
   - `MOCK_*` 배열을 매핑하는 곳에 `useMemo` 적용, 핸들러는 `useCallback`.
   - `Landing` hero stats `.map`은 컴포넌트로 분리 + `React.memo`.

6. **이미지/폰트**
   - `src/styles.css`의 웹폰트에 `font-display: swap` 보장.
   - 큰 PNG/JPG가 import된 경우 `?format=webp&quality=80` 쿼리로 전환 (vite-imagetools 사용 가능 여부 확인 후).

7. **모션 감속 옵션 존중**
   - 모든 jitter/marquee에서 `prefers-reduced-motion: reduce` → 정적 렌더.

#### 3-C. 검증
- `bunx eslint . --max-warnings=0` → 0/0
- `bun run build` 통과
- 브라우저 performance profile로 long task / FPS 확인 (목표: 데스크톱 60fps 안정, Long task < 50ms)

### 변경 없음
- 게임 로직(RTP/지갑/엔진), 라우팅, 디자인 토큰, 150% 보너스, hero stat 3카드 구조.

### 영향 파일 (예상)
- `src/shared/layout/LiveCashoutStrip.tsx`
- `src/mocks/fomo.ts`
- `src/features/landing/Landing.tsx` (+ USDE→USDT grep 결과 파일들)
- `src/shared/motion/LiveNumber.tsx`, `src/shared/motion/CountUp.tsx`, `src/shared/motion/liveOnlineStore.ts`
- `src/shared/motion/liveTickScheduler.ts` (신규)
- `src/shared/motion/FomoMarquee.tsx`, `src/shared/layout/FloatingOrbs.tsx`, `src/styles.css`
- ESLint 결과에 따라 추가 파일

### 기술 메모 (개발자용)
- 글로벌 RAF 스케줄러: `subscribe(cb, intervalMs)` → 내부에서 `performance.now()` 기반 다음 실행 시각 큐, `document.hidden`이면 pause, `visibilitychange`로 resume.
- CountUp DOM 직접 갱신: `useLayoutEffect`에서 ref 확보, RAF로 `ref.current.textContent = format(value)`. 부모 리렌더 없이도 숫자 업데이트 동작.
