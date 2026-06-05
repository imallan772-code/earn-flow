# LAYOUT-L hotfix — Wheel 데스크탑 폭 정정

## 증상
≥1024px에서 `WheelDisplay`의 `aspect-square w-full`이 DesktopShell main `max-w-4xl` 폭(~896px)을 그대로 받아 거대한 정사각형 빈 박스가 생기고, 내부 SVG 휠은 `maxWidth: 280px`로 작게 떠 있음. 하단 컨트롤/베팅 패널이 화면 한참 아래로 밀림.

## 원인
- `DesktopShell`의 `<main className="... lg:max-w-4xl ...">` 폭이 게임에 너무 넓음
- `WheelDisplay` 정사각형 컨테이너는 폭 = 높이 → 폭이 커지면 박스가 통째로 커짐
- 휠 SVG는 280px cap → 비주얼 미스매치

## 보호 대상 (0 diff)
- `WheelDisplay.tsx`, `WheelEngine.ts`, `WheelControls.tsx`, `WheelLegend.tsx`
- `GameShell.tsx`, `styles.css`
- `DesktopShell.tsx` (P-0 SSOT — 다른 게임/페이지 회귀 위험)
- Wheel 외 5게임, supabase, lib/api

## 변경 — 1 파일만

### `src/features/games/wheel/WheelScreen.tsx`
컴포넌트 최상위 `<div className="flex flex-col gap-2">` 에 데스크탑 전용 max-width + 중앙 정렬 추가:

```tsx
// before
<div className="flex flex-col gap-2">

// after
<div className="mx-auto flex w-full flex-col gap-2 lg:max-w-xl">
```

→ `lg:max-w-xl` (576px). 휠 디스플레이 정사각형이 576px 이하로 제한되고, 내부 SVG(280px max)와 시각 균형 회복. 컨트롤/베팅 패널도 같은 폭으로 자연 정렬.

`<1024px`에서는 부모(MobileShell `max-w-md` = 448px)가 더 좁으므로 `lg:max-w-xl`이 무효 → 모바일 0 diff.

## QA

| 항목 | 기대 |
|---|---|
| <1024 Wheel | 모바일 0 diff |
| ≥1024 Wheel center | max-w-xl(576px) 중앙 정렬, 디스플레이 정사각형 ~576px |
| 휠 SVG vs 박스 | 박스가 휠을 적당히 감싸는 균형 (빈 박스 ❌) |
| RightRail | 변동 없음 (P-0 register 그대로) |
| 다른 게임/페이지 | 변동 없음 (WheelScreen 한정) |
| `bun run check` | GREEN |

## 후속 (범위 외)
- P-3에서 K~O 5게임 복제 시 동일 패턴(`lg:max-w-xl` 게임 래퍼) 적용 검토
- 더 큰 wheel 시각을 원하면 별도 라운드에서 `WheelDisplay`의 `WHEEL_SIZE` / `maxWidth` 상향 (현재는 0 diff)
