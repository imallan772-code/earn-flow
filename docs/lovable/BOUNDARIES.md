# Lovable 작업 경계 (BOUNDARIES)

> Lovable = **눈(속도)** · Cursor = **머리+돈+DB(진실)**  
> 스택 SSOT: `docs/TECH_STACK.md`

## 고정 스택 (Lovable 준수)

- TanStack Start v1 · React 19 · TS strict
- Tailwind v4 `@theme` in `src/styles.css` (raw hex 금지)
- Framer Motion: `LazyMotion` + `domAnimation`
- 게임: Canvas2D / Worker-friendly Engine (wallet은 Screen/훅에서만)
- Exchange UI: lightweight-charts shell만 (데이터 wiring = Cursor)

## Lovable 담당 (OK)

| 영역        | 경로                              | 내용                       |
| ----------- | --------------------------------- | -------------------------- |
| UI 화면     | `src/features/**`                 | Screen, Hub, Form 레이아웃 |
| 게임 Engine | `src/shared/games/*/Engine.ts`    | 순수함수 + vitest          |
| 게임 Screen | `src/features/games/**`           | GameShell + 패널 조합      |
| 라우트      | `src/routes/_app/games.*.tsx`     | thin route                 |
| UI 공유     | `src/shared/games/ui/`            | StakeBetPanel 등 재사용    |
| FOMO mock   | `src/mocks/`                      | 표시용 정적 데이터만       |
| 스타일/모션 | `src/shared/motion/`, `className` | Framer Motion              |

## Lovable 금지 (Cursor 전담)

| 영역                  | 경로                               | 이유                 |
| --------------------- | ---------------------------------- | -------------------- |
| Supabase migration    | `supabase/migrations/`             | RLS/RPC/trigger SSOT |
| Supabase client/types | `src/integrations/supabase/`       | phonara-gb 연결      |
| API 래퍼              | `src/lib/api/`                     | RPC 단일 진입점      |
| walletStore 스키마    | `src/shared/wallet/walletStore.ts` | 돈 SSOT              |
| Cursor 규칙           | `.cursor/`, `AGENTS.md`            | Agent 인프라         |
| vitest config         | `vitest.config.ts`, `src/test/`    | 테스트 인프라        |

## Money 규칙 (Lovable)

- **demo 모드**: `useGameWallet` / `walletStore` 기존 패턴 유지 (게임 Screen에서만)
- **real 모드**: 클라이언트 발행 금지 — 베팅/정산은 TODO + Cursor RPC
- **mocks/**: FOMO 숫자만 — Profile/Earn/Withdrawal fallback으로 쓰지 않음
- **VIP/Race/Rakeback**: `src/mocks/` 표시 UI만, Claim이 잔액 올리면 FAIL

## 게임 추가 규칙

1. `*Engine.ts` + `__tests__/*.spec.ts`
2. `*Screen.tsx` — GameShell 위, LiveBetsFeed는 셸 **바깥**
3. `games.<name>.tsx` 라우트
4. `gameRegistry.ts` 등록 (존재 시)
5. `gameRules.ts`에 RULES 추가
6. `liveBetsStore.push/update` (DiceScreen 패턴)

## 흔한 실수 → FAIL

| 실수                        | 올바른 방법                        |
| --------------------------- | ---------------------------------- |
| Screen 300줄+               | Engine/훅 분리                     |
| 인라인 `const DATA = [...]` | `src/mocks/`                       |
| PlinkoBoard 패턴 복제       | GameShell + Engine                 |
| `.rpc()` 직접 호출          | TODO 주석, Cursor가 `src/lib/api/` |
| Mines를 single-step         | `isMultiStep: true`                |

## 참고 문서

- [LOVABLE_WORK_RULES.md](../LOVABLE_WORK_RULES.md)
- [GOLDEN_LOOP.md](../GOLDEN_LOOP.md)
- [ROUND_REPORT_TEMPLATE.md](./ROUND_REPORT_TEMPLATE.md)
