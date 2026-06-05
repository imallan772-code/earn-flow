# ROUND 0 — 공통 인프라 (Lovable 착수용 복붙 SSOT)

| 항목 | 값 |
| ---- | -- |
| **상태** | ✅ 완료 (Cursor, 2026-06-05) |
| **로드맵** | [`GAMES-ROADMAP-v2.1.md`](./GAMES-ROADMAP-v2.1.md) § ROUND 0 |
| **베이스라인** | vitest **90** passed, `bun run check` GREEN |
| **담당** | 🔧 Cursor (Lovable 스킵 — 로컬 선행 완료) |

---

## Lovable에 붙여넣을 전체 프롬프트

아래 ` ```text ` 블록 **전체**를 Lovable 채팅 맨 위에 복붙한다.

```text
=== PHONARA earn-flow · ROUND 0 (공통 인프라) ===

【준수 문서】
1. docs/lovable/PROMPT_HEADER.md
2. docs/lovable/BOUNDARIES.md
3. docs/LOVABLE_WORK_RULES.md
4. docs/TECH_STACK.md
5. docs/backlog/rounds/GAMES-ROADMAP-v2.1.md — § ROUND 0만

【이번 라운드 한 줄】
게임 7종이 공유할 SFX·Hotkeys·Tilt·Share·PF·History·Result·SessionStats 인프라 + StakeBetPanel Auto 탭 리팩터 (동작 불변).

【절대 금지】
- AutoBetPanel.tsx 신규 파일 금지 (StakeBetPanel 확장만)
- supabase/, integrations/supabase/, lib/api/, walletStore 스키마
- *Engine.ts, 게임 Screen (features/games/**) 수정 금지
- placedNonceRef / placingAutoRef / bettingRoundKey / debit===false ref 리셋 로직 **동작 변경 금지** (이동만)

【v2.1 불변 규칙 — useAutoBetController】
StakeBetPanel.tsx에 이미 있는 auto-place 로직을 useAutoBetController.ts로 **추출만**:
- placedNonceRef, placingAutoRef, prevCanPlaceRef
- phaseKey = bettingRoundKey ?? lastOutcome?.nonce ?? -1
- justOpened / firstStart / placedNonceRef === phaseKey 가드
- onPlace Promise → ok===false 시 placedNonceRef = null
- amount 라이브 sync effect (autoRunning 중 currentBet/baseBet 동기화) — 그대로 유지
회귀: Dice·Crash auto 3라운드 연속 시 잔액·nonce 변화 패턴 동일해야 함.

【신규 파일 — 전부 생성】

src/shared/sfx/SfxEngine.ts
- play(id: "bet"|"win"|"loss"|"tick"|"cashout"|"jackpot"|"peg")
- typeof window 가드, AudioContext lazy + resume on gesture
- volume/mute: sfxStore 연동
- prefers-reduced-motion → mute

src/shared/sfx/useSfx.ts
- lazy init, client-only useEffect

src/shared/sfx/__tests__/SfxEngine.spec.ts
- mute 시 play no-op, id별 호출 결정론 (mock AudioContext)

src/shared/hooks/useHotkeys.ts
- useHotkeys(map, { enabled })
- input/textarea/contentEditable 포커스 시 무시

src/shared/hooks/useTilt.ts
- CSS transform perspective, reduced-motion off, SSR 가드

src/shared/hooks/useShareResult.ts
- navigator.share → blob download fallback, SSR 가드

src/shared/hooks/__tests__/useHotkeys.spec.ts
- input focused 시 핸들러 미호출

src/shared/games/ui/AutoBetConfigFields.tsx
- 전략 select, onWin/onLoss %, stopOnProfit/stopOnLoss (StakeBetPanel Auto 탭 전용, 단독 패널 아님)

src/shared/games/ui/useAutoBetController.ts
- 위 【v2.1 불변 규칙】 전체 로직
- initAutoBet / autoStep / startAuto / stopAuto / auto HUD state 반환

src/shared/games/ui/RoundResultCard.tsx
- outcome win/loss floating card, 1.6s fade (m.* + LazyMotion)

src/shared/games/ui/ShareResultButton.tsx
- canvas → PNG, useShareResult

src/shared/games/ui/SessionStatsBar.tsx
- 메모리 only (localStorage X): session P/L, best mult, streak

src/shared/games/ui/ProvablyFairModal.tsx
- MinesScreen FairModal 패턴 추출 (focus trap, ESC, clientSeed input, verify snippet copy)
- props: open, onClose, title?, rows: { label, value, copyable? }[], verifySnippet?, onApplySeed?

src/shared/games/ui/HistoryPillStrip.tsx
- items: { id, multiplier }[]
- 색: <2 muted, <10 cyan, <100 gold, ≥100 rose (@theme 토큰)
- onPillClick → PF 모달 (optional callback)

src/shared/games/ui/__tests__/AutoBetConfigFields.spec.tsx
src/shared/games/ui/__tests__/ProvablyFairModal.spec.tsx

【수정 파일】

src/shared/games/ui/StakeBetPanel.tsx
- Auto 탭: AutoBetConfigFields + useAutoBetController 사용
- props 시그니처 동일: canPlace, hasActiveBet, balance, lastOutcome, bettingRoundKey, onPlace, onCashout, ...
- manual 탭·compact 모드·bettingProgress·suppressCashoutButton 동작 동일

src/styles.css @theme
- --sfx-volume (또는 유사 토큰)
- multiplier tier 4단계 CSS 변수 (pill/history용)

src/shared/games/state/persistedGameState.ts
- sfxStore v1: { enabled: boolean, volume: number } — createGameStore("sfx", ..., 1)
- sessionStats는 영속하지 말 것 (SessionStatsBar 메모리 only)

【미수정】
- features/games/** (모든 Screen)
- PlinkoEngine, usePlinkoRound export
- supabase/, lib/api/, walletStore

【SSR 가드】
navigator.*, Web Audio, window → typeof window + useEffect

【테스트】
- 기존 71+ 유지 + 신규 spec 최소 5개
- autoBet.spec.ts 기존 GREEN 유지

【종료 게이트】
1. bun run lint:strict  (0 warnings)
2. bun run check         (GREEN + build)
3. 수동 QA:
   a. Dice/Crash/Mines/Plinko/Limbo/Wheel — manual 베팅 1회씩
   b. Crash auto 3라운드 연속 (dedupe·금액 변경 다음 라운드 반영)
   c. StakeBetPanel Auto 탭 UI 정상
   d. ProvablyFairModal ESC/focus trap (Story 또는 단위 테스트)
   e. reduced-motion ON → Sfx mute
   f. 게임 Screen 파일 diff 0건

【종료 보고】
docs/lovable/ROUND_REPORT_TEMPLATE.md 형식 + 변경 파일 목록 + supabase/ 0건

=== ROUND 0 끝 ===
```

---

## Cursor pull 후 체크리스트

- [x] `useAutoBetController` — auto 로직 diff가 **이동만**인지 확인
- [x] Crash `bettingRoundKey={nonce}` 회귀 (autoBet.spec.ts GREEN)
- [x] `bun run check` GREEN (90 tests)
- [x] 게임 Screen diff 없음 (ROUND 0 범위)
- [x] `GAMES-ROADMAP-v2.1.md` ROUND 0 상태 → ✅ 완료

## 다음 라운드

ROUND I (Limbo) — 본 프롬프트 완료·Cursor GREEN 후 착수.
