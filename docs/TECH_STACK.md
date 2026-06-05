# PHONARA Tech Stack SSOT

earn-flow 본편의 고정 기술 스택. Lovable·Cursor·에이전트 모두 이 문서를 따른다.

## 워크플로

```text
Lovable 생성 → GitHub export/push → Cursor pull → 최적화·감사·수리 → bun run check GREEN
```

상세: `docs/GOLDEN_LOOP.md`

## 금지 프로젝트

- **phonara-world-main** — 영구 배제 (이식·참조·DB 연결 금지)
- **phonetok** — 참조 금지

## 프론트엔드 코어

| 항목 | 규칙 |
|------|------|
| **Framework** | TanStack Start **v1** (`@tanstack/react-start`) |
| **Router** | TanStack Router — 신규 라우트 `src/routes/` only |
| **React** | **React 19** |
| **TypeScript** | **strict: true** (`tsconfig.json`) — `any` 남발 금지 |
| **번들러** | Vite 7 + `@lovable.dev/vite-tanstack-config` |
| **스타일** | **Tailwind v4 CSS-first** — `src/styles.css` `@theme` SSOT, raw hex 금지 |
| **모션** | **Framer Motion** — 반드시 `LazyMotion` + `domAnimation` (`__root.tsx` 패턴) |
| **패키지 매니저** | **pnpm monorepo** (목표 구조, 아래 참고) |

### vite.config.ts

- 플러그인 **수동 추가 금지** — Lovable/Cursor 모두 `@lovable.dev/vite-tanstack-config`만 사용
- **Vite PWA 플러그인** — Cursor 전담 (Lovable 금지). Service Worker는 프로덕션 빌드에서만

## 모노레포 (목표 구조)

```text
/
├── apps/
│   ├── web/      # 사용자 앱 (현재 earn-flow 본체 → 이전 예정)
│   └── admin/    # 운영 어드민 (desktop)
├── packages/     # 공유 패키지 (types, ui, api-client 등)
├── supabase/     # migrations (Cursor only)
└── pnpm-workspace.yaml
```

> **현재 상태:** 단일 패키지 루트 + `bun` 실행. 마이그레이션 전까지 `bun run *` 유지.  
> monorepo 전환 시 **pnpm** + `apps/web` / `apps/admin`로 분리.

## Supabase (phonara-gb only)

| 항목 | 규칙 |
|------|------|
| 프로젝트 | **phonara-gb** (`kanftnqenuzverroodev`) |
| RLS | public 테이블 전부 ENABLE + 정책 |
| Money | **RPC only** — `SECURITY DEFINER` + `SET search_path = public` + `auth.uid()` |
| Realtime | 피드·라이브벳·잔액 동기화 (Cursor 설계) |
| Edge Functions | PG·웹훅·민감 연산 (Cursor 전담) |
| Client | `src/integrations/supabase/` + `src/lib/api/` 래퍼 |
| Lovable 금지 | `supabase/`, `types.ts`, `lib/api/` |

## 차트 · 게임 렌더링

| 항목 | 규칙 |
|------|------|
| **Exchange** | `@tradingview/lightweight-charts` — `exchange.$symbol` 전용 |
| **게임 Canvas** | **Canvas2D** — Crash, Plinko 등 (DOM overlay 분리) |
| **무거운 연산** | **Web Workers** — RNG·시뮬·대량 히스토리 (메인 스레드 블로킹 금지) |

## 품질 게이트

```bash
bun run check    # vitest + build (현재)
bun run lint:strict
```

monorepo 전환 후: `pnpm --filter web check` 등으로 대체.

## 역할 분담 요약

| 영역 | Lovable | Cursor |
|------|---------|--------|
| UI / Engine / Screen | O | 감사 |
| Tailwind @theme 토큰 | O (기존 토큰만) | SSOT 수호 |
| Supabase / RPC / RLS | X | O |
| PWA plugin | X | O |
| lightweight-charts wiring | UI shell | 데이터·구독 |
| Web Workers | Engine 분리 제안 | SSOT·배선 |
| wallet / money | 게임 UI만 | SSOT |
