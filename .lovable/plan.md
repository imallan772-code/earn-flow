# ROUND K v1 — WheelLegend (색별 배당 범례)

## 목적

Stake/Rollbit 휠처럼 **칸 색깔 = 배당** 매핑을 한눈에 보여주는 범례 칩 1줄을 휠 아래 추가. 사용자가 "왜 칸마다 숫자가 안 보이지?" 의문을 해소.

## 범위

### 신규 파일 1개

**`src/features/games/wheel/WheelLegend.tsx`** (memo)

- props: `risk: WheelRisk`, `segments: WheelSegments`
- `useMemo`: `WheelEngine`의 멀티플라이어 배열 생성 함수를 호출 → `Map<multiplier, count>` 집계 → 멀티 오름차순 정렬
- 색 매핑 (기존 `WheelDisplay` 토큰 재사용):
  - `0×` → `--color-muted`
  - `low band` → `--color-cyan`
  - `medium band` → `--color-gold`
  - `high band (≥3×)` → `--color-rose`
- 렌더: `flex flex-wrap gap-2`, 각 칩 = `glass-2` + 색 도트(`size-2 rounded-full`) + `{mult}× ×{count}`
- 모바일 `flex-wrap`, 반응형 패딩

### 수정 1개

**`src/features/games/wheel/WheelScreen.tsx`**

- `import { WheelLegend }` 추가
- `historyStrip` 또는 `displayArea` 하단에 `<WheelLegend risk={risk} segments={segments} />` 1줄 삽입
- 위치: `WheelDisplay` 바로 아래, `WheelControls` 위 (시각적 흐름: 휠 → 색 의미 → 조작)
- 그 외 로직/레이아웃 0 diff

## 절대 미접촉

- `WheelEngine.ts` (배당 배열 생성 함수만 import, 0 diff)
- `persistedGameState.ts`
- `WheelDisplay.tsx`, `WheelControls.tsx` (props 변경 없음)
- 다른 게임 화면 / `styles.css` / `gameRules.ts`
- `supabase/` / `src/integrations/supabase/types.ts` / `src/lib/api/`

## SSOT 준수

- raw tailwind 팔레트 (`bg-cyan-400`, `text-white/40` 등) 절대 금지
- `glass-2` + `color-mix(in oklab, var(--color-*) X%, transparent)` 만 사용
- 색 도트는 CSS variable inline style 허용 (도트 색이 동적이므로)

## 테스트

신규 테스트 없음 (순수 표시 컴포넌트, 로직은 기존 엔진 재사용).
필요 시 ROUND K+ 에서 스냅샷 1개 추가 검토.

## 게이트

- `bun run lint:strict` → 0 warn
- `bun run check` → **105+ GREEN 유지** (현재 baseline 105)
- 수동 QA:
  1. risk Low/Med/High 전환 시 범례 즉시 갱신
  2. segments 10/20/30 전환 시 칩 개수 합 = segments
  3. 모바일 360px 폭에서 wrap 정상
  4. 0× 칩이 항상 좌측 (정렬 확인)

## Cursor pull 감사 체크리스트

- [ ] `WheelEngine.ts` diff = 0
- [ ] Dice/Crash/Mines/Plinko/Limbo/Lobby diff = 0
- [ ] `WheelDisplay.tsx` / `WheelControls.tsx` diff = 0
- [ ] `styles.css` diff = 0
- [ ] `gameRules.ts` diff = 0
- [ ] `persistedGameState.ts` diff = 0
- [ ] raw tailwind 팔레트 0 occurrence (`rg "bg-(cyan|gold|rose)-\d"`)
- [ ] `lint:strict` 0 + `check` 105+

## Files

- **Created**: `src/features/games/wheel/WheelLegend.tsx`
- **Modified**: `src/features/games/wheel/WheelScreen.tsx`

## 다음 라운드

ROUND L — 사용자 정의 (게임 폴리시 또는 신규 게임 후보).
