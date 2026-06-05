
## 목표
상단 칩(`10,048,293`)과 히어로 stats의 "전 세계 실시간 접속"(`1,012만+`)이 **항상 같은 숫자**를 가리키도록 한다. (포맷만 다르게 — 칩=원시숫자, 히어로=만+ 단위)

## 문제
- 현재 칩: `MOCK_ONLINE_BASE = 10,048,293` 기준 LiveNumber
- 히어로 stat: `base: 10,120,000` 기준 LiveNumber (별도 인스턴스, 다른 base)
- 둘이 서로 다른 base에서 독립적으로 jitter → 절대 동일하게 안 보임

## 해결 방법: 전역 동기화 스토어
숫자 한 개를 한 곳에서 jitter시키고 두 컴포넌트가 같은 값을 구독하게 한다.

### 1) `src/shared/motion/liveOnlineStore.ts` (신규)
- `MOCK_ONLINE_BASE`(=10,048,293)를 base로 하는 단일 jitter 루프
- amplitudeRatio 0.003, bias 0.52, intervalMs 2800 (한 곳에서만 돌아감)
- `useLiveOnline()` 훅: 현재 값을 구독해 반환 (useSyncExternalStore)
- `prefers-reduced-motion`/`document.hidden` 가드 유지
- 첫 구독 시 루프 시작, 마지막 구독 해제 시 정지 (ref count)

### 2) `src/shared/motion/LiveNumber.tsx` — 옵션 확장
- 외부에서 `value`를 직접 주입할 수 있는 변형 추가 (기존 `base/amplitudeRatio/bias` 모드는 그대로 유지)
- 또는 더 간단히, 두 컴포넌트가 `useLiveOnline()` 값을 받아 `CountUp`으로 직접 렌더링하도록 호출부만 수정 (LiveNumber 수정 없음). 이 방식 채택.

### 3) `src/shared/layout/OnlineCounterChip.tsx`
- 기존 `<LiveNumber base={MOCK_ONLINE_BASE} ... />` 제거
- `const v = useLiveOnline();` → `<CountUp value={v} duration={1400} format={(n)=>KO.format(Math.round(n))} />`

### 4) `src/features/landing/Landing.tsx` — 히어로 stats 렌더링
- `s.live`가 "전 세계 실시간 접속" 항목(mode=`manlike`, key=`globalOnline` 같은 플래그)인 경우:
  - `useLiveOnline()` 사용해 `CountUp value={v} format={(n)=>formatManlike(n,"+")}`
- 다른 stat(`오늘 지급 PHON` 등)은 기존 LiveNumber 그대로

### 5) `src/mocks/fomo.ts`
- 히어로 stats 중 "전 세계 실시간 접속" 항목에 `syncKey: "globalOnline"` 플래그 추가 (Landing에서 분기용)
- `live.base`는 더 이상 사용 안 되지만 타입 호환 위해 `MOCK_ONLINE_BASE`로 통일

## 결과
- 칩과 히어로 카드가 **정확히 같은 순간 같은 숫자**를 표시 (포맷만 `10,048,293` ↔ `1,005만+`)
- 참고: `10,048,293` → `formatManlike` = `1,005만+`. 사용자가 보여준 `1,012만+`은 옛 base였음. 실제 동기화하면 칩 숫자에 맞춰 `1,005만+` 부근으로 표시됨 (둘 다 함께 미세 변동).

## 영향 파일
- 신규: `src/shared/motion/liveOnlineStore.ts`
- 수정: `src/shared/layout/OnlineCounterChip.tsx`, `src/features/landing/Landing.tsx`, `src/mocks/fomo.ts`

비즈니스 로직/RTP/지갑/게임 코드 변경 없음.
