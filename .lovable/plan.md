# ROUND M — Plinko 끝판왕 (1 PR, Polish Only)

**SSOT**: `docs/backlog/rounds/GAMES-ROADMAP-v2.1.md § ROUND M` + `docs/lovable/PROMPT_HEADER.md` + `docs/CURSOR_AUDIT_NOTES.md` + `docs/WHOSE-TURN.md`
**Non-goal**: v2.2/v2.3 (Realtime/Race/Vault/PF Edge/Cashier) — **M은 Plinko 단일 게임 폴리시만**

---

## 🔴 레드라인 (위반 시 즉시 롤백)

- `PlinkoEngine.ts` 수학 **0-diff** (MULTIPLIERS · dropPath · simulatePhysics 결과·시그니처 불변)
- `usePlinkoRound` **export 시그니처 git diff 0** (return 객체 키/타입 그대로)
- `StakeBetPanel` 계약 불변 (`onPlace` / `lastOutcome` / `bettingRoundKey`)
- **미수정**: `supabase/`, `src/integrations/supabase/types.ts`, `src/lib/api/`, `walletStore` schema, `.cursor/`, `vitest.config.ts`, `routeTree.gen.ts`
- 신규 npm 의존성 **금지** (react-window은 ROUND O)

---

## 스코프

### 1. 5공 큐 (연타)
- `PlinkoBoard.tsx`: 내부 queue (max 5), `handlePlace` 연타 허용
- `usePlinkoRound`: **시그니처 동결**, 내부에서 동시 in-flight ≥1 지원
  - `nonce++` = **enqueue 시점** (`debit roundId` 와 1:1 매칭)
  - `roundId = plinko-n${nonce}` per-ball
  - `canPlace` 키 유지, 의미만 `queue.length < 5 && !reducedMotion`
  - `phase` semantics: 5공 중에도 `canPlace=true` 가능 → Board가 queue SSOT, hook은 export 키만 고정
- live feed: 공마다 별도 `liveBetsStore.push` / `update`

### 2. Visual Polish
- `PlinkoRenderer.ts`: peg 충돌 글로우 (0.4s decay), 슬롯 잔광 (1.6s · jackpot 2.2s + ring)
- `PlinkoCanvasView.tsx`: 잔광 레이어 prop wiring, jackpot overlay 유지
- 신규: `PlinkoSlotRow.tsx` — 슬롯 배수 row 컴포넌트 분리

### 3. SFX 통합
- `PlinkoSFX.ts`: 자체 AudioContext **제거** → `SfxEngine` 위임
- mute key (`phonara.plinko.muted`) ↔ SfxEngine 글로벌 mute 동기화

### 4. 인프라 Wiring (Crash/Mines/Limbo 동일 패턴)
- `gameRules.ts` PLINKO_RULES: PF · HistoryPillStrip · RoundResultCard · ShareResultButton · SessionStatsBar 후크
- `PlinkoScreen.tsx`: 위 컴포넌트 마운트

### 5. Persist
- `persistedGameState.ts`: `plinkoStore` **v1 유지** + `{ ...initial, ...parsed }` merge 가드 (L-2 패턴) — `clientSeed` 등 신규 필드 안전
- migrate 함수 작성 X
- 신규: `src/shared/games/state/__tests__/plinkoStore.persist.spec.ts`

### 6. UX / 접근성
- Space = 발사, ←/→ = risk 사이클 — `useHotkeys` (input/textarea/contentEditable 자동 제외)
- `useReducedMotion` ON → 큐 비활성, 단일 공만 낙하 + 트레일 off
- `useRngWorker` 로 dropPath 사전계산 (메인 스레드 jank 방지, 동기 fallback)

---

## 💰 Money 정책 (Plinko-specific)

| 상황 | 동작 |
|---|---|
| 큐 full (5공) | toast "라운드 진행 중", enqueue 차단 |
| Risk/Rows 변경 | 큐 비었을 때만 허용, 진행 중 → toast |
| **Real unmount** | 새 enqueue 차단 + in-flight 정산 완료까지 drain, **refund RPC 호출 0** |
| Demo unmount | 즉시 큐 클리어 OK |
| `useUnmountRefund` | **미장착** (long-round 전용 hook) |

근거: 1공 ~800ms · 5공 큐 ~3-4s → Crash/Mines/Limbo refund 패턴 부적합, Dice/Wheel block-only 패턴 채택

---

## ✅ Acceptance Criteria

- **AC-M-1**: 5연타 → 5공 큐 정산, 잔액 정확
- **AC-M-2**: `usePlinkoRound` export 시그니처 git diff 0
- **AC-M-3**: 큐 비었을 때만 risk/rows 변경, 진행 중 → toast
- **AC-M-4**: real unmount → 새 enqueue 차단 + in-flight settle 완료, RPC refund 호출 0 (테스트 + 주석 명시)
- **AC-M-5**: plinkoStore v1 유지, persist 파괴 시 `{ ...initial, ...parsed }` 복원
- **AC-M-6**: AudioContext 인스턴스 = 1 (SfxEngine), `getPlinkoSFX` 는 wrapper
- **AC-M-7**: hotkey input/textarea/contentEditable 무시
- **AC-M-8**: reduced-motion ON → 큐 비활성, 단일 공만 낙하

---

## 🚪 Exit Gate

- `bun run lint:strict` — 0 warn
- `bun run check` — GREEN (test + build)
- SSR 가드 (window / AudioContext 접근 모두 effect 내부)
- 수동 QA 6항목: 5연타 / risk-during-queue block / unmount drain / reduced-motion / mute persistence / jackpot overlay
- **회귀 0건**: Crash · Mines · Limbo · Dice · Wheel auto 3 라운드 통과, StakeBetPanel dedupe 유지

---

## 📋 보고

`docs/lovable/ROUND_REPORT_TEMPLATE.md` 양식. 보고서 말미에 **"Cursor 차례"** 명시 (WHOSE-TURN.md 갱신은 Cursor 담당)

---

## Post-M 큐 (참고, 본 PR 범위 아님)

```text
[지금]   Lovable  → ROUND M (Plinko)        ← 진행
[다음]   Cursor   → M sanitation + WHOSE-TURN.md 갱신
[그다음] Lovable  → L-3 + L1-E (small PR)
[그그다음] Lovable → ROUND N (Mines 분리)
[그그그] Lovable  → ROUND O (react-window)
[병렬]   Cursor   → ROUND P (Realtime, M과 충돌 거의 없음)
```
