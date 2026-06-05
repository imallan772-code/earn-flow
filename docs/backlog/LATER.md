# LATER — 나중에 할 일 마스터 리스트

마지막 정리: **2026-06-05** (Cursor 정렬 세션 기준)

**범례**

| 기호 | 의미 |
|------|------|
| P0 | 프로덕션·머니 안전 직전에 필수 |
| P1 | 사용자 체감 큼, 다음 스프린트 권장 |
| P2 | 품질·완성도, 여유 있을 때 |
| P3 | 장기 최적화 |
| 🤖 Lovable | UI·게임 엔진·화면 (`src/features/**`) |
| ⚙️ Cursor | Supabase·`lib/api`·인프라·품질 게이트 |
| 🤝 협업 | Lovable UI + Cursor RPC/DB |

---

## P0 — Money Layer

| # | 작업 | 담당 | 상태 | 메모 |
|---|------|------|------|------|
| M1 | Money v2 RPC **soak test** — 스테이징에서 `VITE_MONEY_RPC_V2=true`로 베팅·정산·멱등·잔액 동기화 검증 | ⚙️ Cursor | ⬜ 대기 | v1 기본값 유지 중. v1 RPC **수정·삭제 금지** |
| M2 | soak GREEN 후 클라이언트 **기본값 v2 전환** (`wallet.ts`) | ⚙️ Cursor | ⬜ 대기 | M1 완료 후. 롤백 플래그는 env로 유지 |
| M3 | v2 전환 후 Supabase `get_advisors` 보안·성능 재점검 | ⚙️ Cursor | ⬜ 대기 | phonara-gb only (`kanftnqenuzverroodev`) |

---

## P1 — Games (Lovable P2)

Mines P1 완료 (`990584f`). 아래 6종은 레지스트리 `open: false`.

| # | 게임 | 담당 | 상태 | 메모 |
|---|------|------|------|------|
| G1 | **Slots** | 🤖 Lovable | ⬜ 대기 | Engine + Screen + route + `gameRules` + registry `open: true` |
| G2 | **Roulette** | 🤖 Lovable | ⬜ 대기 | 동일 패턴 |
| G3 | **RPS** | 🤖 Lovable | ⬜ 대기 | 동일 패턴 |
| G4 | **LuckyBox** | 🤖 Lovable | ⬜ 대기 | 동일 패턴 |
| G5 | **CardFlip** | 🤖 Lovable | ⬜ 대기 | 동일 패턴 |
| G6 | **Keepy-Uppy** | 🤖 Lovable | ⬜ 대기 | RTP TBD, 동일 shell 패턴 |

**P2 공통 체크리스트** (게임마다)

- [ ] `shared/games/shell/` — `createGameStore` + `useGameRound` + `GameShell`
- [ ] `*Engine.ts` + vitest (`shared/games/**/__tests__`)
- [ ] `features/games/*/*Screen.tsx` + `routes/_app/games.*.tsx`
- [ ] `gameRules.ts` + `GAME_REGISTRY` route/rules 연결
- [ ] real money 베팅 지점 → `useGameWallet` only (직접 `.rpc()` 금지)
- [ ] `bun run check` GREEN (Lovable 라운드 종료 시)

**선택 (P2)** — 기존 4종 shell 통일

| # | 작업 | 담당 | 상태 |
|---|------|------|------|
| G7 | Crash / Dice / Plinko를 Mines와 동일 **GameShell** 패턴으로 정리 | 🤖 Lovable | ⬜ 대기 |

---

## P1 — Domain · Realtime

| # | 작업 | 담당 | 상태 | 메모 |
|---|------|------|------|------|
| D1 | Missions / Events / Trading UI **실데이터 soak** (mock 잔존 구간 점검) | 🤝 협업 | ⬜ 대기 | hooks·lib 이미 연결됨 |
| D2 | Realtime 잔액·라이브벳 **프로덕션 부하** 테스트 | ⚙️ Cursor | ⬜ 대기 | |
| D3 | `integrations/supabase/types.ts` 원격 스키마와 **주기적 동기화** | ⚙️ Cursor | ⬜ 대기 | migration 후 regenerate |

---

## P2 — Tailwind · UI 완성도

**현재:** Tailwind v4 CSS-first **이미 적용** (`src/styles.css` `@theme` SSOT). 추가 “전환” 불필요.

| # | 작업 | 담당 | 상태 | 메모 |
|---|------|------|------|------|
| T1 | `text-(--color-*)` → `@theme` 유틸 단축 (`text-muted`, `bg-surface` 등) | 🤖 Lovable | ⬜ 대기 | ~40+ 파일. 동작은 이미 정상, 가독성·IDE 힌트 개선 |
| T2 | `src/features` 잔여 **raw hex** 제거 (DepositCrypto 등) | 🤖 Lovable | ⬜ 대기 | TECH_STACK: class에 hex 금지 |
| T3 | shadcn `components/ui/*` 신규 추가 시 **항상** `styles.css` 토큰만 사용 | 🤖 Lovable | ⬜ 대기 | 규칙 준수 점검 |

---

## P2 — Quality Gate · DX

| # | 작업 | 담당 | 상태 | 메모 |
|---|------|------|------|------|
| Q1 | `bun run check`에 **`lint:strict` 포함** | ⚙️ Cursor | ⬜ 대기 | 현재: typecheck + test + build만 |
| Q2 | CI/GitHub Actions에 `check` + (선택) Supabase Preview **문서화** | ⚙️ Cursor | ⬜ 대기 | Preview는 migration 이름 정렬 필수 |
| Q3 | `pnpm --filter` 기반 check로 **monorepo 게이트** 통일 | ⚙️ Cursor | ⬜ 대기 | `packageManager: pnpm` 목표 구조 |

---

## P3 — Performance · Infra

| # | 작업 | 담당 | 상태 | 메모 |
|---|------|------|------|------|
| I1 | 메인 번들 **code-split** (`index-*.js` 500kB+ 경고) | ⚙️ Cursor | ⬜ 대기 | `dynamic import()` on heavy routes |
| I2 | Exchange chart / Plinko canvas **Worker** 분리 검토 | ⚙️ Cursor | ⬜ 대기 | TECH_STACK: 무거운 연산 Worker |
| I3 | lockfile **pnpm 단일화** (bun.lock 과도기 종료) | ⚙️ Cursor | ⬜ 대기 | Golden Loop 팀 합의 후 |
| I4 | Admin 앱 (`apps/admin`) 프로덕션 배포 파이프라인 | ⚙️ Cursor | ⬜ 대기 | port 5174 dev only |

---

## P3 — Product · FOMO (여유 시)

| # | 작업 | 담당 | 상태 | 메모 |
|---|------|------|------|------|
| F1 | 피드·랜딩 **실시간 합성 데이터** → Supabase/Edge 전환 검토 | 🤝 협업 | ⬜ 대기 | 현재 mocks FOMO display |
| F2 | PWA **오프라인·푸시** 전략 (VitePWA 이미 빌드만) | ⚙️ Cursor | ⬜ 대기 | `vite.config.ts` Cursor 전담 |
| F3 | i18n ko/en **누락 문자열** audit | 🤖 Lovable | ⬜ 대기 | `shared/i18n/` |

---

## 완료됨 (기록용)

| 날짜 | 작업 |
|------|------|
| 2026-06-05 | Tailwind v4 CSS-first SSOT (`styles.css` `@theme`) — **이미 적용, 유지** |
| 2026-06-05 | Tailwind canonical class + `lint:strict` GREEN (`95f66b6`, `52c18b1`) |
| 2026-06-05 | Money v2 RPC + RLS + anon revoke (phonara-gb remote 적용) |
| 2026-06-05 | Supabase migration 로컬↔원격 파일명 정렬 (`412bf0a`) |
| 2026-06-05 | Mines P1 — shell, vitest, route LIVE (`990584f`) |
| 2026-06-05 | LazyMotion `strict` 제거 — Lovable 패턴 정렬 (`52c18b1`) |

---

## 빠른 참조 — 지금 하지 말 것

- `tailwind.config.js` 복구 ❌
- `vite.plugins`에 `tailwindcss()` 수동 추가 ❌
- Money **v1 RPC** 덮어쓰기/삭제 ❌
- **phonara-world-main** 참조·연결 ❌
