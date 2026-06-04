## 라운드 X — 중복 제거 (단일 PR, 코드만 줄음)

라운드 B/C에서 생긴 신규 엔진과 기존 mock VisualShell 두 벌이 공존 중. 신규(결정론 엔진)만 남기고 기존 mock 계열 11파일 통째로 삭제. 새 기능 추가 0, 중복 제거 100.

---

### 삭제 (11파일)

**Game VisualShells (6개)** — 모두 mock-only, `earn/games/$slug.tsx`에서만 import됨
- `src/features/games/crash/CrashVisualShell.tsx`
- `src/features/games/rps/RpsVisualShell.tsx`
- `src/features/games/slots/SlotsVisualShell.tsx`
- `src/features/games/lucky-box/LuckyBoxVisualShell.tsx`
- `src/features/games/roulette/RouletteVisualShell.tsx`
- `src/features/games/card-flip/CardFlipVisualShell.tsx`

**구 라우트 (2개)** — VisualShell 디스패처
- `src/routes/earn/games/$slug.tsx`
- `src/routes/earn/games/index.tsx`

**구 컴포넌트/Mock (3개)** — 위 라우트에서만 사용
- `src/features/games/lobby/GameLobby.tsx` (75줄, 신규 `src/features/games/GameLobby.tsx`와 중복)
- `src/mocks/games.ts` (`MOCK_GAMES`, `MOCK_BET_HISTORY` — 신규 `crashHistory.ts`로 흡수됨)

**디렉토리 정리**
- `src/features/games/rps/`, `slots/`, `lucky-box/`, `roulette/`, `card-flip/`, `lobby/` 빈 폴더 제거
- `src/routes/earn/games/` 빈 폴더 제거

---

### 수정 (1파일)

- `src/shared/layout/GameBetShellChrome.tsx` — `backTo` 기본값 `/earn/games` → `/earn` (남은 사용처가 있을 경우 대비). 사용처 확인 후 없으면 이 파일도 삭제 검토.

---

### 검증 게이트
1. `bunx tsc --noEmit` 클린 (broken import 0)
2. `bunx vitest run` 33/33 GREEN 유지
3. `routeTree.gen.ts` 자동 재생성 후 `/earn`, `/games/crash`, `/games/dice` 진입 정상
4. `rg "VisualShell|MOCK_GAMES|earn/games"` 결과 0건

---

### 라운드 D~F에서 RPS/Slots/Roulette/LuckyBox/CardFlip을 다시 만들 때
- 결정론 엔진(Round A) 기반으로 **밑바닥부터** 작성
- 라우트는 `/games/{slug}` (신규 컨벤션 통일)
- mock 데이터는 게임별 `mocks/{slug}.ts` 분리

삭제된 mock VisualShell 코드는 git history에 보존됨 — 참고 필요시 복원 가능.

---

**범위:** 신규 기능 0, 삭제만. 라운드 D(Slots) 들어가기 전에 베이스 클린.
