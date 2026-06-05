# LOVABLE_WORK_RULES — Lovable 작업 공통 규칙 (지존급 끝판왕 버전)

> **Lovable 진입점:** [docs/lovable/README.md](./lovable/README.md)  
> **매 라운드 복붙:** [docs/lovable/PROMPT_HEADER.md](./lovable/PROMPT_HEADER.md)

이 문서는 Lovable AI에게 작업을 지시할 때마다 반드시 참고해야 하는 상위 규칙이다.
모든 프롬프트 시작 부분에 **PROMPT_HEADER.md 전체**를 복붙할 것.

## 1. 프로젝트 비전 및 대상

- 주요 대상: 한국 20~70대 (직장인, 주부, 대학생, 프리랜서)
- 핵심 가치: **무료 부수입 + 낮은 진입장벽** (틱톡 공차기 게임 같은 느낌)
- 바이럴 전략: 강력한 FOMO + 친구 추천 + 매일 접속 유도
- 3초 규칙: 가입 → 즉시 게임/기능 진입이 가능해야 함
- 1인 운영으로도 장기 유지 가능한 구조를 추구한다.

## 2. 기본 철학 (지존급 수준)

- **단일 진실 출처**와 **Atomicity**를 최우선으로 한다. 특히 금전이 오가는 로직은 절대 중간 상태를 허용하지 않는다.
- **관심사 분리**를 철저히 지킨다. UI / Domain / Infrastructure를 명확히 분리한다.
- **비즈니스 로직을 컴포넌트에 때려박는 것**을 가장 경계한다 (Lovable이 자주 하는 실수).
- **Trust & Transparency**: Provably Fair, 명확한 정산, 감사 가능한 코드를 기본으로 한다.

## 3. 기술 제약 사항

- **zustand 사용 절대 금지**. `useSyncExternalStore` + localStorage + TanStack Query 기반 패턴을 유지한다.
- 타이머 타입은 `ReturnType<typeof setTimeout>`을 사용한다. (`NodeJS.Timeout` 금지)
- SSR 안전을 항상 확보한다.
- 불필요한 의존성 추가를 강력하게 제한한다.

## 4. 모바일 및 UX 원칙

- 모바일 기준: **390×844 무스크롤**을 기본으로 설계한다.
- 터치 최적화, safe-area 대응, 60fps 목표를 우선시한다.
- FOMO와 프리미엄 네온 느낌을 해치지 않는 범위에서 성능 최적화를 진행한다.

## 5. 아키텍처 원칙

- `GameShell`은 **순수 레이아웃** 컴포넌트로 유지한다. 어떤 비즈니스 로직도 포함하지 않는다.
- `useGameRound`는 single-step과 multi-step을 명확히 분리한다.
- 게임 핵심 로직은 가능한 한 **순수 함수(Engine)** 형태로 분리한다.
- Server State와 UI State를 명확히 분리한다.
- Admin 기능은 `/admin` 라우트 + features/admin 격리로 관리하여 추후 분리하기 쉽게 한다.

## 6. 금전 및 신뢰 관련 최우선 규칙 (절대 타협 금지)

- 잔액, 베팅, 정산, 캐쉬아웃, 출금 관련 로직은 **가장 보수적이고 명확하게** 작성한다.
- 클라이언트에서 "최종 결과"를 결정하는 로직은 최소화하고, 가능하면 서버(RPC/Edge Function)로 위임할 수 있게 설계한다.
- 모든 금전 이동은 감사(audit)가 가능하도록 고려한다.
- "대충 안전할 것이다", "지금은 데모니까"라는 생각으로 타협하지 않는다.
- 에러 발생 시에도 잔액이 깨지거나 중복 정산이 발생하지 않도록 defensive하게 작성한다.

## 7. 문서화 규칙

- 모든 파일 상단에 **역할 + 주요 결정 이유**를 명확히 작성한다.
- Real money 모드에서 Supabase로 옮겨야 할 부분은 반드시 `TODO:` 주석으로 남긴다.
  예: `// TODO: Real money 모드에서는 rollFn을 Supabase Edge Function으로 옮겨야 함`
- "왜 이렇게 했는지"를 설명하는 주석을 우선시한다.

## 8. Lovable 작업 시 피해야 할 패턴

Lovable이 특히 자주 하는 아래 패턴을 강력하게 피할 것:

- 컴포넌트 안에 복잡한 비즈니스 로직, 상태 관리, API 호출을 과도하게 넣는 행위
- 타입을 느슨하게 작성하는 행위 (`any`, 과도한 `unknown` 사용)
- `useEffect`를 남발하거나 의존성 배열을 부정확하게 작성하는 행위
- 한 파일에 너무 많은 책임을 몰아넣는 행위
- "일단 동작하게 만들고 보자" 식의 임시 코드나 주석 처리된 코드를 남기는 행위
- 기존 export, localStorage key, 데이터 구조를 함부로 변경하는 행위

## 9. 최종 타겟 아키텍처 (항상 의식)

Lovable에서 작업하더라도 최종적으로 아래 스택으로 이식될 것을 전제로 한다:

- **Frontend**: TanStack Start + React 19 + TypeScript (strict)
- **Styling & Animation**: Tailwind CSS v4 + Framer Motion
- **Backend**: Supabase (RLS + RPC security definer + Realtime + Edge Functions)
- **Trading**: @tradingview/lightweight-charts
- **고성능 게임**: Canvas + Web Workers (+ OffscreenCanvas)
- **PWA**: Vite PWA 플러그인
- **Monorepo**: pnpm (`apps/web` + `apps/admin`)

Lovable에서 코드를 생성할 때도 위 스택으로 자연스럽게 확장/이식될 수 있는 방향으로 작성한다.

## 10. 세계 최상위 플랫폼을 위한 마인드셋

- Stake.com, Rollbit, Binance, Bybit 수준 이상의 **신뢰성, 성능, UX**를 목표로 한다.
- **신뢰성 > 개발 속도**를 우선한다. 특히 돈이 오가는 영역에서는 절대 타협하지 않는다.
- 1인 개발자가 장기적으로 운영할 수 있는 구조와 문서화를 유지한다.
- 사용자가 "이 플랫폼은 진짜 잘 만들었다"는 느낌을 받을 수 있는 품질을 추구한다.
