# LAYOUT-L hotfix v2 — Wheel 박스 빈 공간 제거

## 현 상태 (스크린샷 확인)
- v1 hotfix(`lg:max-w-xl` = 576px) 적용됨 → 박스가 화면 전체에서 ~520px로 축소됨 ✅
- 하지만 휠 SVG는 280px cap → 정사각형 박스(520×520) 안에 휠이 상단 중앙에만 그려져 하단 큰 빈 공간 잔존

## 원인
`WheelDisplay`의 내부 SVG는 `maxWidth: 280px` 고정 (보호 대상, 0 diff). 박스 폭 > 휠 폭일 때 박스 하단 빈 공간이 그대로 보임.

## 변경 — 1 파일, 1 줄

### `src/features/games/wheel/WheelScreen.tsx` line 339
```tsx
// before (현재)
<div className="mx-auto flex w-full flex-col gap-2 lg:max-w-xl">

// after
<div className="mx-auto flex w-full flex-col gap-2 lg:max-w-md">
```

`lg:max-w-md` = 448px = 모바일 MobileShell과 동일 폭.
박스(448²) - p-4(32) = 416px → SVG 280px maxWidth가 그대로 적용되지만 휠과 박스의 시각 비율이 모바일과 동일해짐.

## 기대 결과
- 데스크탑 ≥1024 Wheel: 박스 약 448×448, 휠이 박스를 자연스럽게 채움 (모바일 동일)
- 모바일: 0 diff (부모 max-w-md가 이미 좁아 무효)
- 컨트롤/베팅 패널: 동일 폭으로 정렬
- RightRail, 사이드바, 타 게임/페이지: 0 diff

## 보호 대상 (계속 0 diff)
`WheelDisplay`, `WheelEngine`, `WheelControls`, `WheelLegend`, `GameShell`, `DesktopShell`, `styles.css`, 타 5게임, supabase, lib/api.

## QA
- ≥1024 `/games/wheel` — 박스 ~448², 휠이 박스 거의 가득 채움
- <1024 — 모바일 0 diff
- `bun run check` GREEN

## 후속 (범위 외)
박스를 더 크게 가져가고 싶다면 별도 라운드에서 `WheelDisplay`의 `WHEEL_SIZE`/`maxWidth` 상향 (현재 보호).
