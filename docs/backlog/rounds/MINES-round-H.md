# ROUND H — Mines "Zenith" Polish (최종본 v3, 착수 가능)

| 항목           | 값                                         |
| -------------- | ------------------------------------------ |
| **상태**       | ✅ Lovable 완료 + Cursor pull/merge (2026-06-05) |
| **승인일**     | 2026-06-05                                 |
| **완료일**     | 2026-06-05 (origin `f684e92`)            |
| **담당**       | 🤖 Lovable → 🔧 Cursor merge               |
| **베이스라인** | vitest **71** → **77** GREEN (persist/restore 6케이스) |
| **검토**       | Cursor 검토 7건 + bomb-hit 즉시 null (v3)  |

---

## Lovable에 보낼 지시 (복붙용)

```text
ROUND H v3 최종 승인. docs/backlog/rounds/MINES-round-H.md 전체 스펙대로 착수.

필수:
- PROMPT_HEADER.md 맨 위 붙이기
- minesStore version=1 유지, migrate 0줄
- 복원: round.place() + hydrate만 (tryDebit/push 금지)
- bomb hit / cashout 같은 tick에 activeRound = null
- CLIENT_SEED 상수 제거 → store clientSeed
- 종료: bun run lint:strict && bun run check (73/73) && build OK

미수정: supabase/, lib/api/, MinesEngine, GameShell, useGameRound, createGameStore
종료 보고: docs/lovable/ROUND_REPORT_TEMPLATE.md
```

---

PROMPT_HEADER + 검토 7건 + bomb-hit 즉시 null 정리 모두 반영. 엔진/지갑/Supabase/공용 셸 시그니처 불변.

### 비대상 (불변 — PROMPT_HEADER 절대금지 준수)

- `supabase/**`, `src/integrations/supabase/**`, `src/lib/api/**`
- `MinesEngine.ts`, `houseEdge.ts`, `provablyFair.ts`
- `GameShell.tsx`, `useGameRound.ts`, `StakeBetPanel.tsx`, `createGameStore.ts`
- `walletStore.ts` 스키마, `useGameWallet.ts`
- `liveBetsStore.ts` (사용만)
- 다른 게임 화면(Dice/Crash/Plinko/Limbo/Wheel)
- 신규 npm 패키지 0개, `vite.config.ts` 미접촉, zustand 미도입
- localStorage key 변경 0건 (`phonara.gamestate.mines.v1` 유지)

---

### 작업 범위

#### 1) 인터랙션 & 게임감 (`m.*` + LazyMotion 기존 사용)

- 타일 flip 3D: `rotateY` 0→180, spring(220/18), 200ms.
- Gem 등장: scale 0.6→1 + sparkle dot 4개 fadeOut.
- Bomb hit: 보드 wrapper shake 1회(±4px, 160ms), rose flash overlay, 미공개 지뢰 stagger reveal 35ms.
- Cashout: 안전 타일 일제 flip + emerald glow pulse + `<CountUp>` 멀티 0.8s.
- 호버 멀티 프리뷰: **단일 absolute 툴팁 1개**를 좌표 이동(25 DOM 아님).

#### 2) 정보 표시 (수식 명시)

- 다음 픽 승률 (정확식):

  ```
  p = (TOTAL_TILES - mineCount - revealed.length)
    / (TOTAL_TILES - revealed.length)
  ```

- 다음 멀티: `nextMultiplier(revealed.length + 1, mineCount)` (엔진 재사용).
- 상단 정보바: `지뢰 N · 보석 r/safe · 다음승률 XX.X% · 멀티 X.XXx`.

#### 3) 컨트롤 폴리시

- 지뢰 수 프리셋 칩 `[1, 3, 5, 10, 24]` + 기존 ±버튼 유지.
- 랜덤 픽 버튼(디바운스 200ms, playing only).
- **키보드 (의도 명시)**: `0–9` = 상단 0~9번 타일, `c` = cashout, `r` = random pick. UI 안내 1줄: _"1–0 = 상단 10칸 / R 랜덤 / C 캐쉬아웃"_.
- 햅틱: `navigator.vibrate?.(8)` gem, `(40)` bomb (옵셔널 체이닝, iOS 안전).

#### 4) 접근성

- `aria-label="타일 {n+1}, {상태}"`, 보드 `role="grid"`.
- visually-hidden `aria-live="polite"` 영역에 멀티·결과 announce.
- PF 모달 ESC 닫기 + focus trap(첫 입력 포커스, close 버튼까지 Tab 순환).

#### 5) 영속성 — **minesStore v1 유지, migrate 없음**

- `createGameStore("mines", initial, 1)` 그대로. localStorage key 불변.
- `MinesPersisted`에 두 필드 추가:

  ```ts
  activeRound: ActiveRound | null; // 진행 중 라운드
  clientSeed: string; // 기본 = 기존 상수와 동일
  ```

- `createGameStore` 내부 `{ ...initial, ...parsed }` 머지로 기존 저장본 자동 호환.

**ActiveRound 스키마 (liveBetId 포함)**:

```ts
interface ActiveRound {
  nonce: number;
  amount: number;
  mineCount: number;
  mines: number[];
  revealed: number[];
  liveBetId: string;
  placedAt: number;
}
```

**복원 규칙 (이중 차감 절대 금지)**:

- 마운트 시 `activeRound != null` →
  - `setActive({ amount, mineCount, mines, liveBetId, nonce })`
  - `setRevealed(activeRound.revealed)`
  - `round.place()` (state hydrate만, idle→playing 전이)
  - **handlePlace / tryDebit / liveBetsStore.push 호출 금지**.

**라운드 라이프사이클별 `activeRound` 갱신**:

- `handlePlace` 성공 직후: `activeRound = { ... }` 세팅 (debit 후 1회).
- `handleReveal` 안전 타일: `activeRound.revealed.push(tile)` (스토어 1회 set).
- `handleReveal` bomb hit: **같은 tick에 `activeRound = null`** + history/lastOutcome 업데이트.
- `handleCashout`: 같은 tick에 `activeRound = null` + history/lastOutcome.
- settled→idle cleanup useEffect는 그대로(추가 보호).

#### 6) 공정성 (clientSeed 와이어링)

- **상수 `CLIENT_SEED` 제거**. `placeMines({ clientSeed: minesStore clientSeed, ... })`.
- PF 모달:
  - 클라이언트 시드 input (32자, 비우면 기본값 사용).
  - 저장 시: nonce 0 리셋 + `activeRound = null` + 안내 토스트.
  - 서버 시드 해시·nonce·검증 스니펫 **복사 버튼**(`navigator.clipboard.writeText`).
- 진행 중 라운드는 종료 후 새 시드 적용.

#### 7) 성능 가드

- `MinesTile.tsx` `React.memo`, props는 boolean/number만.
- `tiles` / `nextPickChance` / `multiplierPreview` 전부 `useMemo`.
- `useReducedMotion()` → transform 비활성, opacity만.
- `will-change: transform`은 `playing` 동안만.
- 호버 툴팁 = 단일 absolute 요소 재사용.
- 타이머는 `ReturnType<typeof setTimeout>` (PROMPT_HEADER 필수).

---

### 종료 게이트

1. `bun run lint:strict` — 0 warning (`eslint . --max-warnings=0`과 동일)
2. `bun run check` — **73/73 PASS** (baseline 71, 신규 2)
3. `bun run build` — 성공
4. 수동 QA 6항목:
   - place → reveal×3 → cashout (정산 연출)
   - place → bomb hit (shake + 전체 reveal)
   - **진행 중 새로고침** → 동일 보드/revealed 복원, **잔액 변화 0**
   - **bomb hit 후 새로고침** → idle 상태로 시작(activeRound null)
   - PF 모달에서 시드 변경 → nonce 0 리셋 + 다음 라운드 새 배치
   - 키보드 `1` `2` `r` `c` 동작 + reduced-motion ON 1라운드
5. 로비/Dice/Crash/Plinko/Limbo/Wheel 무회귀
6. `supabase/` 변경 0건 확인

---

### 신규 테스트 (총 71 → 77)

- `src/shared/games/state/__tests__/minesStore.persist.spec.ts` — v1 hydrate 머지 3케이스
- `src/shared/games/state/__tests__/minesStore.restore.spec.ts` — activeRound 라이프사이클 3케이스 (bomb hit 즉시 null 포함)

---

### 파일

**Modified (3)**

- `src/features/games/mines/MinesScreen.tsx`
- `src/shared/games/state/persistedGameState.ts`
- `src/shared/games/rules/gameRules.ts`

**Created (3)**

- `src/features/games/mines/MinesTile.tsx`
- `src/shared/games/state/__tests__/minesStore.persist.spec.ts`
- `src/shared/games/state/__tests__/minesStore.restore.spec.ts`

**Unmodified (보장)**

- 모든 엔진·shell·wallet·api·supabase·다른 게임 화면·vite.config.ts.

---

### 라운드 종료 보고

`docs/lovable/ROUND_REPORT_TEMPLATE.md` — 변경 파일, 비대상 8항목 Y/N, lint/check/build, 수동 QA, supabase 변경 0건.

---

### Cursor 이관 (라운드 종료 후)

1. ~~`git pull`~~ ✅ `f684e92` fast-forward
2. ~~`bun run lint:strict && bun run check`~~ ✅ lint:strict 0 · vitest **77/77** · build OK
3. ~~`docs/CURSOR_SANITATION_CHECKLIST.md` 감사~~ ✅ grep 감사 PASS (wallet/mock/rpc Screen)
4. ~~본 문서 상태 갱신~~ ✅

**Cursor 로컬 merge:** stash → pull → stash pop (`.lovable/plan.md`만 Lovable 쪽 유지). Mines 파일 충돌 없음.

---

### 다음 라운드 후보 (이번 미포함)

- WebAudio 사운드(asset → Cursor)
- Auto Bet 모드(별도 라운드)
- 화살표 키 보드 네비 25칸
- 컨페티(번들 부담)
- minesStore v2 마이그레이션(Cursor가 createGameStore에 migrate 훅 추가 후)
