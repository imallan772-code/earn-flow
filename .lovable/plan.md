# ROUND N — Mines 분리·폴리시 (확정)

SSOT: `docs/backlog/rounds/GAMES-ROADMAP-v2.1.md § ROUND N`
선행: ✅ ROUND H + L-3+L1-E Cursor sanitation, `bun run check` 145/145 GREEN
베이스라인: `MinesScreen.tsx` **814줄** (검증 확인)

## 목표

`MinesScreen.tsx` **814 → 400 이하**. 인라인 PF 모달 / history pill JSX / 보드·툴팁·플립 / 컨트롤을 각각 공통 컴포넌트 + 신규 2파일로 추출. 공통 인프라(SFX·RoundResultCard·Share·SessionStats·ProvablyFairModal·HistoryPillStrip·AutoBet) 적용.

## 레드라인 (위반 시 즉시 폐기)

- 0-diff: `MinesEngine.ts`, `MinesTile.tsx`, `houseEdge.ts`, `provablyFair.ts`, `GameShell`, `useGameRound`, `useGameWallet`, `useUnmountRefund`
- 0-diff: `StakeBetPanel` props 계약 (`onPlace` / `lastOutcome` / `bettingRoundKey`)
- 0-diff: `minesStore` version=1 스키마 (필드 추가 금지 — `clientSeed`/`activeRound` 이미 존재)
- 0-diff: `supabase/`, `src/integrations/supabase/`, `src/lib/api/`, `walletStore` 스키마
- 0-diff: `HistoryPillStrip` 기존 호출부 (Crash/Wheel/Limbo/Dice) — default `multiplier` 유지
- 신규 npm 의존성 금지
- 이중 차감 금지: `tryDebit` / `liveBetsStore.push`는 `handlePlace` **1곳만** (ROUND H 불변식)
- `ensureUserPending` 경로 보존

## 작업 범위

### 신규 (2)

| 경로 | 역할 | 줄 예산 |
|---|---|---|
| `src/features/games/mines/MinesDisplay.tsx` | 5×5 그리드 + MinesTile 매핑 + 호버 멀티 프리뷰(단일 absolute 툴팁 재사용) + bomb shake / rose flash / 미공개 지뢰 stagger reveal / cashout glow pulse. props: `{ tiles, revealed, mines, active, hoverIndex, onHover, onReveal, gameState, mineCount, bet, reducedMotion }` | ~180 |
| `src/features/games/mines/MinesControls.tsx` | 지뢰 프리셋(1/3/5/10/24) 칩 + custom stepper + 캐쉬아웃 버튼 + multi badge + 키보드 HUD. props: `{ mineCount, onMineCountChange, active, currentMult, nextMult, onCashout, disabled }` | ~140 |

### 수정 (2~3)

- `src/features/games/mines/MinesScreen.tsx` (**814 → 380 목표**)
  - 보드/툴팁/플립 → `<MinesDisplay/>` 위임
  - 지뢰 컨트롤/캐쉬아웃/HUD → `<MinesControls/>` 위임
  - 인라인 PF 모달 → `<ProvablyFairModal/>` (clientSeed 변경 시 nonce 리셋 + `activeRound` 클리어 보존)
  - 인라인 history pill → `<HistoryPillStrip displayMode="multiplier"/>`
  - 공통 인프라 wiring:
    - `useSfx` — bet/win/loss/cashout/peg(gem)/jackpot(≥10x)
    - `useHotkeys` — 기존 1–0/R/C/ESC 핸들러를 훅으로 이동 (input/textarea 제외)
    - `useShareResult` + `<ShareResultButton/>`
    - `<RoundResultCard/>` 1.6s floating
    - `<SessionStatsBar/>` 메모리 derive (영속 X)
    - `StakeBetPanel` Auto 탭 활성화 (랜덤 N픽 1~24)
  - 오케스트레이션·`useGameRound`·`tryDebit`·`refund`·`commitServerSeed` 위치/순서 변경 금지

- `src/shared/games/rules/gameRules.ts` (선택)
  - MINES_RULES shortkeys 이미 1–0/R/C/ESC 존재 — 누락분 있으면 보강, 없으면 0-diff

- `.lovable/plan.md` — 라운드 메모 갱신

### 미수정

`MinesEngine.ts`, `MinesTile.tsx`, `persistedGameState.ts`(minesStore 스키마), `useGameRound`, `useGameWallet`, `StakeBetPanel`, `provablyFair.ts`, `houseEdge.ts`, `supabase/`, `lib/api/`, `walletStore`

## Acceptance Criteria

- **AC-N-1**: `wc -l MinesScreen.tsx` ≤ 400
- **AC-N-2** (핵심): `MinesDisplay.tsx` + `MinesControls.tsx` 존재 & Screen 본문에서 해당 JSX/핸들러 제거 (줄 수만 줄고 로직 잔존 시 FAIL)
- **AC-N-3**: 베팅 → gem reveal × N → cashout 잔액 정확
- **AC-N-4**: bomb hit → shake + rose flash + 미공개 지뢰 stagger reveal
- **AC-N-5**: 새로고침 mid-round → 동일 보드/revealed 복원, 재debit 0
- **AC-N-6**: PF 모달 clientSeed 변경 → nonce 0 + activeRound 클리어
- **AC-N-7**: 키보드 1–0/R/C/ESC 동작 (input focus 시 제외)
- **AC-N-8**: reduced-motion ON → 애니메이션 off, 로직 정상
- **AC-N-9**: HistoryPillStrip Crash/Wheel/Limbo/Dice 회귀 0
- **AC-N-10**: StakeBetPanel auto 3라운드 Dice/Crash/Mines 회귀 0 (nonce·잔액 변화량 일치)

## 종료 게이트

```text
1. bun run lint:strict          # 0 warnings
2. bunx vitest run              # 145+ GREEN
3. bun run check                # build success
4. wc -l src/features/games/mines/MinesScreen.tsx   # ≤ 400
5. 수동 QA: AC-N-3 ~ AC-N-8
6. SSR 가드: navigator.vibrate?, Web Audio (SfxEngine), share
```

## Cursor sanitation grep 포인트 (N merge 후)

```bash
wc -l src/features/games/mines/MinesScreen.tsx          # ≤400
grep -rn "MinesDisplay\|MinesControls" src/features/games/mines/
grep -n "tryDebit" src/features/games/mines/MinesScreen.tsx  # handlePlace 1곳
git diff -- src/shared/games/ui/HistoryPillStrip.tsx    # 0-diff
git diff -- src/shared/games/state/persistedGameState.ts # minesStore 0-diff
```

## Non-goal (v2.2/v2.3 이월)

- Realtime 멀티 / Race / Vault
- AutoBet manual reveal 시퀀스 학습 (랜덤 N픽까지)
- Edge Function 지뢰 배치 (TODO 주석만)
- ROUND O (Lobby / react-window)

## Post-N 큐

```text
[지금]   Lovable → ROUND N (Mines)            ← 본 plan
[다음]   Cursor  → N sanitation + grep 포인트
[그다음] Lovable → ROUND O (Lobby + react-window)
[병렬]   Cursor  → ROUND P (Realtime feed, v2.2)
```
