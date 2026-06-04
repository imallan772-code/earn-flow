# Round G Part 0 — Plinko 라우트 등록 + Dice 자동베팅 복원

두 작업 묶음. 둘 다 작고 독립적.

---

## A. Plinko 라우트 등록 (3파일)

PlinkoBoard 완성됐지만 어디서도 import 안 됨. 진입 경로 연결.

### A-1. `src/features/games/plinko/PlinkoScreen.tsx` (신규)
얇은 래퍼. `useMode()` → `PlinkoBoard`.
```tsx
import { useMode } from "@/shared/mode/ModeContext";
import { PlinkoBoard } from "@/shared/games/plinko/PlinkoBoard";

export function PlinkoScreen() {
  const { mode } = useMode();
  return <PlinkoBoard mode={mode} />;
}
```

### A-2. `src/routes/_app/games.plinko.tsx` (신규)
games.dice.tsx 패턴:
```tsx
export const Route = createFileRoute("/_app/games/plinko")({
  head: () => ({ meta: [
    { title: "Plinko · PHONARA" },
    { name: "description", content: "Provably Fair Plinko. 8/12/16줄 × 3리스크." },
  ]}),
  component: PlinkoScreen,
});
```

### A-3. `src/features/games/GameLobby.tsx` (수정)
- `GameId` union에 `"plinko"` 추가
- `GAMES` 배열에 `{ id: "plinko", name: "Plinko", rtp: "97%", liveBets: ..., Icon: CircleDot, open: true, accent: "violet" }` 추가
- 카드 클릭 분기에 `if (card.id === "plinko") return <Link to="/games/plinko">...</Link>`

### A-4. PlinkoBoard 헤더에 백버튼 확인
PlinkoBoard 헤더 (`PLINKO` 라벨 영역)에 Lobby로 돌아가는 `ArrowLeft` + `<Link to="/games">`가 없으면 DiceScreen 패턴(L148 근처) 따라 추가. 헤더 높이 h-9 유지.

---

## B. Dice 자동베팅 복원 (1파일)

**회귀 원인 확정**: `src/features/games/dice/DiceScreen.tsx` L213이 `variant="compact"`. StakeBetPanel L58에서 `compact ? "manual" : tab` 강제 → Auto 탭 자체가 숨겨짐.

### B-1. `src/features/games/dice/DiceScreen.tsx` 수정
- L213 `variant="compact"` 제거 (default "full" → Manual/Auto 탭 노출)
- L214 `showAutoTarget={false}` **유지** (Dice는 즉시 결과라 auto-cashout 타겟 무의미; auto-bet의 base bet / on-loss / on-win 증감만 유효)
- 그 외 props 변경 없음 — `lastOutcome`은 이미 전달 중이라 autoBet reducer가 정상 동작

### B-2. Plinko는 의도적으로 compact 유지
PlinkoBoard L253-254의 `variant="compact" showAutoTarget={false}`는 그대로. (Plinko는 매 라운드 입력 인터랙션이 본질이라 auto-bet UX 부적합)

---

## 강제 규칙
- `routeTree.gen.ts` 수동 편집 금지 (Vite 플러그인 자동 생성)
- `persistedGameState.ts` 수정 금지
- `PlinkoBoard` 시그니처 변경 금지 — Screen은 순수 래퍼
- `StakeBetPanel` 자체는 수정 금지 — props만 조정

## 검증
- `/games/plinko` 진입 → 캔버스 렌더 + 베팅 정상
- Lobby에서 Plinko 카드 보임 + 클릭 시 라우트 이동
- `/games/dice` 진입 → BetPanel 상단에 Manual/Auto 탭 2개 보임
- Auto 탭에서 횟수/on-loss/on-win 설정 → Start 시 자동 진행, Stop 동작
- TS strict GREEN
- iPhone SE / 14 무스크롤 유지

## 완료 보고
"Plinko가 /games/plinko 라우트로 등록되고 Lobby에 카드 추가됨. Dice 자동베팅(Manual/Auto 탭) 복원 완료."
