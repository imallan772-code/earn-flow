# PC Desktop 전환 v2.1 — 로드맵 + LAYOUT-L (Wheel 파일럿)

> **v2.1 변경점**: (a) LiveBets 데스크탑 단일 인스턴스 QA, (b) RightRail register
> 패턴 SSOT 계약, (c) P-0 착수 시점 = ROUND K(Dice) merge 직후 명시.
> v2 본문 유지.

## 1. 로드맵 (확정 v2.1)

| Phase | 담당 | 범위 | 큐 |
| --- | --- | --- | --- |
| ROUND K | Lovable | Dice (게임 라운드, 별개 트랙) | 진행 중 |
| **P-0** | Cursor | 데스크탑 셸 인프라 | **K merge GREEN 직후 1 PR** |
| **LAYOUT-L** | Lovable | Wheel 데스크탑 파일럿 | P-0 merge 확인 후 |
| P-1 | Cursor | 로비 + Landing + Money(Deposit/Withdrawal) DesktopShell + SEO | LAYOUT-L 후 |
| P-2 | Cursor | 전역 RightRail SSOT 정리 (헤더/route default rail) | P-1 후 |
| **P-3** | Lovable | Dice/Crash/Mines/Plinko/Limbo LAYOUT-L 패턴 일괄 복제 | P-2 후 |

- Golden Loop **1 PR 원칙** → K와 P-0 병렬 금지, 순차 진행.
- 게임 라운드 L-1(Crash) 와 LAYOUT-L 이름 분리 유지.

---

## 2. Cursor P-0 결과물 계약 (v2.1)

### 2.1 브레이크포인트 SSOT — 1024 단일 기준

```ts
// src/shared/hooks/useDesktopLayout.ts  (신규)
export function useDesktopLayout(): boolean;  // min-width 1024px
```

- 앱 셸/게임 분기는 **반드시** `useDesktopLayout()` 또는 Tailwind `lg:`.
- `useIsMobile` (768) 은 shadcn Sidebar 내부 Sheet 전환용으로 격리.
- SSR/hydration: 초기값 `false` + `useEffect` matchMedia 구독.
- **FOUC 완화**: 셸 마크업은 `lg:` CSS grid + `hidden lg:flex` 병행 (hook 분기 보조).
- vitest 2개 (true/false matchMedia mock).

### 2.2 셸 + Sidebar (단일화)

```
src/shared/layout/
  DesktopShell.tsx
  ResponsiveShell.tsx
  AppSidebar.tsx   # shadcn primitives wrapper, SSOT 1파일 (이중화 금지)
```

- `@theme` 토큰: `--sidebar-width: 240px`, `--sidebar-width-icon: 60px`, `--rightrail-width: 320px`.
- 너비 클래스 `w-[var(--sidebar-width)]` 형태 (Tailwind v4 함정).
- `BottomNav`: `< lg` 에서만 렌더.

### 2.3 RightRail 주입 — Context + register SSOT (v2.1 강화)

```ts
// src/shared/layout/GameLayoutContext.tsx  (신규)
// 매 렌더 새 JSX 전달로 인한 Context update loop 방지.
// register 패턴 SSOT — Lovable LAYOUT-L 은 이 시그니처를 그대로 사용.
export function useRegisterRightRail(
  key: string,                          // 게임 식별자 (e.g. "wheel")
  render: () => ReactNode,              // 렌더 함수 (참조 안정성 책임은 호출자)
  deps: ReadonlyArray<unknown>,         // useEffect deps 와 동일 의미
): void;
```

- 마운트 시 등록 / 언마운트 시 자동 cleanup.
- `< lg` 에서는 no-op.
- DesktopShell 내부 Provider 가 등록된 render() 호출 → 우측 영역 렌더.

### 2.4 GameViewport 최소 훅

```ts
// src/shared/layout/useGameViewport.ts  (신규)
export function useGameViewport(): { width: number; height: number };
```

- ResizeObserver 기반. Wheel 520px cap 동적 계산용.
- P-3 canvas 게임 (Plinko/Crash) 연동은 별도 Cursor 서브태스크 예고.

### 2.5 P-0 게이트

- vitest GREEN (useDesktopLayout 2개 + 회귀 100+).
- `lint:strict` 0.
- 모바일 (< 1024) 시각 회귀 0.
- **125% OS 배율** (실효 ~819px) → 모바일 셸로 정상 폴백.
- 게임 파일 0 diff.

---

## 3. LAYOUT-L — Wheel 데스크탑 파일럿 (Lovable)

### 3.1 목표

- `< 1024px` → `WheelScreen` 0 diff.
- `≥ 1024px` → 3컬럼 와이드. 로직 0 diff, 표시 계층만.

### 3.2 레이아웃 (≥ lg)

```text
┌─────────┬───────────────────────────────┬──────────────┐
│ Sidebar │   Center (max-w-[860px])      │  Right Rail  │
│ (P-0)   │  WheelHeader (PF/룰)          │  Session     │
│         │  HistoryPillStrip             │  Stats       │
│         │  ┌──────────┬──────────────┐  │  ──────────  │
│         │  │ Wheel    │  Controls    │  │  Wheel       │
│         │  │ (≤520px) │  +Legend     │  │  LiveBets    │
│         │  │          │  +BetPanel   │  │  (FOMO,      │
│         │  └──────────┴──────────────┘  │   sticky)    │
│         │  DemoLowBanner                │              │
└─────────┴───────────────────────────────┴──────────────┘
```

- Wheel 크기 = `min(520, useGameViewport().width − 컨트롤폭)`.
- "채팅" 표현 금지 — 우측 = `SessionStatsBar` + `LiveBetsFeed (FOMO)`.

### 3.3 파일

**신규**
- `src/features/games/wheel/WheelDesktopLayout.tsx` — 슬롯 grid, 비즈 로직 0.
- `src/features/games/wheel/WheelRightRail.tsx` — SessionStatsBar + Wheel LiveBets.

**수정 1개**
- `src/features/games/wheel/WheelScreen.tsx`
  - `useDesktopLayout()` 분기 (Tailwind `lg:` 병행).
  - 모바일/데스크탑 셸에 **동일 slot 노드** 전달.
  - 데스크탑 분기: `useRegisterRightRail("wheel", useCallback(() => <WheelRightRail />, []), [])`.
  - **모바일 하단 `<LiveBetsFeed game="wheel" />` 는 `!useDesktopLayout()` 조건부 렌더** — 데스크탑 중복 금지.

### 3.4 절대 미접촉

- `WheelEngine.ts`, `WheelDisplay.tsx`, `WheelControls.tsx`, `WheelLegend.tsx` — 0 diff.
- 다른 게임/로비/스토어/PF/persistedGameState — 0 diff.
- `supabase/`, `src/integrations/supabase/types.ts`, `src/lib/api/` — 금지.
- `styles.css` — 0 diff.
- `useIsMobile` — 호출 금지.

### 3.5 SSOT 게이트

- 색/글래스 = `@theme` + `glass-2/3`. raw tailwind palette 금지.
- 모바일 동작/시각 100% 보존.
- 사이드바 collapse 시 휠 비율 유지 (`useGameViewport`).
- `register` 시그니처는 P-0 SSOT 그대로. `useCallback`로 render 참조 안정화.
- `bun run lint:strict` 0 / `bun run check` GREEN.

### 3.6 수동 QA

1. `< 1024px` → 모바일 UI 픽셀 동일.
2. `≥ 1024px` → 3컬럼 정상, 휠/컨트롤/라이브베팅 표시.
3. 사이드바 collapse → 휠 자연스럽게 확장.
4. 라운드 진행 (베팅→스핀→정산) 모바일/데스크탑 정상.
5. 우측 LiveBets sticky 동작.
6. 125% OS 배율 1280 → 데스크탑 셸 유지, 깨짐 없음.
7. **`≥ 1024px` 에서 LiveBetsFeed 1 인스턴스만 (DOM 검증)** — 중복 FOMO/성능 회귀 차단.

---

## 4. P-3 일괄 적용 패턴

`<GameDesktopLayout>` + `useRegisterRightRail` + `LiveBets desktop 단일 인스턴스` 패턴을 5개 게임에 복제. 엔진/스토어 0 diff. Canvas 게임(Plinko/Crash)은 P-3 직전 Cursor의 `useGameViewport ↔ canvas` 서브태스크 선행.

---

## 5. "Stake 압살" 범위 (정직)

**달성**: PC 3열 패리티 + 모바일 0 회귀 + 게임 패턴 검증.
**미달**: Realtime/채팅/real-money/게임 가짓수/브랜드 — 별 트랙.
→ **Visual Parity Phase 1** 로 라벨링.

---

## 6. 다음 액션

1. **Lovable**: 진행 중인 ROUND K(Dice) 완료 → merge GREEN.
2. **Cursor**: P-0 (§2) 1 PR → vitest/lint/125% QA GREEN → merge.
3. **Lovable**: P-0 merge 확인 → LAYOUT-L 빌드 모드 진입 → §3 구현.

v2.1 GO 확정 — 승인 부탁드립니다.
