# ROUND N — Mines 분리·폴리시 ✅ 완료

## 결과

| 항목 | 결과 |
|---|---|
| `MinesScreen.tsx` | **814 → 388줄** (AC-N-1 ≤400 ✅) |
| `MinesDisplay.tsx` (신규) | 133줄 — 보드/툴팁/shake/flash |
| `MinesControls.tsx` (신규) | 112줄 — stepper/preset/random/cashout/HUD |
| `useMinesLifecycle.ts` (신규) | 333줄 — place/reveal/cashout/random + 복원/SFX/RecentResult |
| `bunx vitest run` | **141/141 GREEN** |
| `bun run lint:strict` | **0 warn / 0 error** |

## 적용된 공통 인프라

- `ProvablyFairModal` — 인라인 FairModal 교체 (clientSeed 변경 → nonce 0 리셋 + activeRound 폐기)
- `HistoryPillStrip` (displayMode=multiplier, won 전달)
- `SessionStatsBar` + `recordSessionOutcome` (win/loss)
- `RoundResultCard` + `ShareResultButton` (1.6s floating + PNG)
- `useSfx` — bet / peg(gem reveal) / cashout / loss / jackpot(≥10x)
- `useHotkeys` — 1–0 / R / C / ESC / M (input/textarea 자동 제외)

## 불변식 보존 (0-diff 확인)

- `MinesEngine.ts`, `MinesTile.tsx`, `houseEdge.ts`, `provablyFair.ts`
- `GameShell`, `useGameRound`, `useGameWallet`, `useUnmountRefund`
- `StakeBetPanel` props 계약 (compact / showAutoTarget=false / suppressCashoutButton)
- `minesStore` 스키마 (clientSeed / activeRound 기존 필드만 사용)
- `tryDebit` / `liveBetsStore.push` — handlePlace 1곳 (이중 차감 0)
- `supabase/`, `lib/api/`*, `walletStore` 스키마

\* prettier --fix 가 기존 pretty-debt 였던 `src/lib/api/walletSchemas.ts` + `.spec.ts` 와 `src/shared/games/plinko/PlinkoBoard.tsx` 의 **공백/줄바꿈만** 정리. 의미 0-diff. Cursor sanitation 시 grep 으로 확인 권장 — boundary 우려 시 revert 가능.

## Non-goal (의도적 미반영)

- AutoBet manual reveal 시퀀스 — StakeBetPanel `variant="compact"` + `showAutoTarget={false}` 유지 (Mines 멀티스텝 auto 루프는 별도 라운드)
- Realtime / Race / Vault — v2.2
- Edge Function 지뢰 배치 — TODO 주석만

## 다음

```
[다음]   Cursor  → N sanitation
[그다음] Lovable → ROUND O (Lobby + react-window)
[병렬]   Cursor  → ROUND P (Realtime feed, v2.2)
```
