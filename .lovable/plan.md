## ROUND L-2 PR2 — Real Money Mid-Round Cancel (Lovable)

SSOT: `docs/lovable/rounds/ROUND-L-2.md` · prerequisites L-2-pre (Limbo 1-slot) merged · Cursor PR1 refund RPC merged.

### Scope (5 games + 1 hook + 1 panel)

| Game | PF (applySeed) | Unmount | Notes |
|------|----------------|---------|-------|
| Crash | refund RPC + meta | refund RPC + meta | 현재 refund 있으나 meta 없음 → meta 부착 |
| Mines | refund RPC + meta | refund RPC + meta | 둘 다 신규 |
| Limbo | refund RPC + meta | refund RPC + meta | 둘 다 신규 (L-2-pre는 legacy drain만) |
| Dice  | **block** while active | — | 시드 변경 차단 + toast |
| Wheel | **block** while active | — | 시드 변경 차단 + toast |

### Files

| 구분 | 경로 |
|------|------|
| 신규 | `src/shared/wallet/useUnmountRefund.ts` |
| 신규 | `src/shared/wallet/__tests__/useUnmountRefund.spec.ts` |
| 수정 | `src/features/games/crash/CrashScreen.tsx` |
| 수정 | `src/features/games/mines/MinesScreen.tsx` |
| 수정 | `src/features/games/limbo/LimboScreen.tsx` |
| 수정 | `src/features/games/dice/DiceScreen.tsx` |
| 수정 | `src/features/games/wheel/WheelScreen.tsx` |
| 수정 | `src/shared/games/ui/StakeBetPanel.tsx` |

### Non-touch (PR2)

`supabase/**`, `src/integrations/supabase/types.ts`, `src/lib/api/**`, `walletStore.ts` 스키마, `useGameWallet.ts`(API 0-diff — `refund(amount, { game, roundId })`은 이미 존재).

---

### Technical details

#### 1. `useUnmountRefund` (SSOT for Crash/Mines/Limbo)

```ts
// src/shared/wallet/useUnmountRefund.ts
import { useEffect, useRef } from "react";
import type { GameWalletMeta } from "./useGameWallet";

type RefundFn = (amount: number, meta?: GameWalletMeta) => Promise<boolean>;

interface PendingRefund {
  amount: number;
  meta: GameWalletMeta; // { game, roundId } REQUIRED for real RPC
}

/**
 * On unmount: if `getPending()` returns a non-null bet, call refund() fire-and-forget.
 * Idempotent on server (refund_phon_for_bet_v2 — same roundId as debit).
 */
export function useUnmountRefund(
  refund: RefundFn,
  getPending: () => PendingRefund | null,
) {
  const refundRef = useRef(refund);
  const getRef = useRef(getPending);
  refundRef.current = refund;
  getRef.current = getPending;
  useEffect(() => {
    return () => {
      const p = getRef.current();
      if (!p || p.amount <= 0) return;
      void refundRef.current(p.amount, p.meta).catch(() => undefined);
    };
  }, []);
}
```

Spec (`useUnmountRefund.spec.ts`, 3 cases):
- pending null → refund 0회
- pending set → unmount 시 refund 1회 with meta
- refund reject → no throw (fire-and-forget)

#### 2. CrashScreen

- 기존 unmount effect (line 129–134): `refundRef.current(b.amount)` → **meta 부착**. `useUnmountRefund(refund, () => { const ar = crashStore.get().activeRound; return ar && ar.cashedAt === null ? { amount: ar.amount, meta: { game: "crash", roundId: \`n${ar.nonce}\` } } : null; })`로 교체. 기존 ad-hoc effect 삭제.
- `applySeed` (line 392~): `refundRef.current(ar.amount)` → `void refund(ar.amount, { game: "crash", roundId: \`n${ar.nonce}\` }).catch(() => undefined)`. activeRound의 nonce 사용 (현재 store nonce ≠ active nonce일 수 있음).

#### 3. MinesScreen

- 신규: `useUnmountRefund(refund, () => { const ar = minesStore.get().activeRound; return ar ? { amount: ar.amount, meta: { game: "mines", roundId: \`n${ar.nonce}\` } } : null; })`.
- `applySeed`: clientSeed 변경 분기에서 activeRound 있으면 refund 1회 후 `activeRound: null`. roundId = `n${ar.nonce}`.

#### 4. LimboScreen

- 신규: `useUnmountRefund(...)` — activeRound 있고 settle 미수행이면 refund.
- `applySeed`: activeRound 있으면 refund 1회 후 nonce 0 리셋 + `activeRound: null`. roundId = `n${ar.nonce}`.
- L-2-pre의 legacy drain effect는 그대로 유지 (별개).

#### 5. DiceScreen — PF block

`applySeed` 진입 시 `if (!round.isIdle || activeBet)` → `appToast.raw.error("진행 중인 라운드가 있어 시드를 변경할 수 없습니다")` 후 return. RPC 호출 없음.

#### 6. WheelScreen — PF block

`applySeed` 진입 시 `if (!round.isIdle || wheelStore.get().activeRound)` → 동일 토스트 후 return. 기존 `activeRound: null` 분기 삭제.

#### 7. StakeBetPanel — real integer clamp

`useMode()` 추가:
```ts
import { useMode } from "@/shared/mode/ModeContext";
const { mode } = useMode();
const isReal = mode === "real";
const minBet = isReal ? 1 : 0.01;
const step = isReal ? 1 : 0.01;
```
- input: `min={minBet}`, `step={step}`.
- onChange: real → `Math.max(0, Math.floor(Number(e.target.value) || 0))`; demo → 기존.
- ½ / 2x: real → `Math.max(minBet, Math.floor(...))`; demo → 기존 `+(...).toFixed(2)`.
- MAX: real → `Math.floor(balance)`.
- 베팅 버튼 disabled 조건: real → `amount < 1`도 disable. 토글 시 amount < 1 이면 클램프 표시 (단순 floor + min 적용 useEffect 1회).
- 잔액 표시 단위: 기존 "USDT" 유지 (mode 분기 표시는 별개 — 본 PR scope 외).

---

### Acceptance criteria (per ROUND-L-2.md)

- AC-3: real `tryDebit(0.49)` → false (이미 `toIntegerPhonAmount`로 처리). StakeBetPanel real <1 / non-integer 입력 차단 — **UI 단에서 차단**.
- AC-4: Crash PF betting 중 → refund RPC 1회 `{ game:'crash', roundId }`.
- AC-5: Mines unmount mid-round → refund RPC 1회.
- AC-6: Limbo activeRound + PF → refund RPC 1회.
- AC-7: Dice/Wheel PF while active → blocked + toast, RPC 0회.
- Gate: `bun run check` GREEN. supabase / lib/api / types 0-diff.

### Manual QA (PR2 complete)

- [ ] Crash PF mid-betting → 잔액 복원 (real)
- [ ] Crash navigate away mid-round → refund 1회 (network 탭 `refund_phon_for_bet_v2`)
- [ ] Mines PF + unmount 각 1회
- [ ] Limbo single-slot PF + unmount 각 1회
- [ ] Dice/Wheel PF spin 중 시도 → toast 차단, RPC 0회
- [ ] StakeBetPanel real: 0.49 입력 → 0 으로 클램프, 베팅 disabled
- [ ] StakeBetPanel demo: 0.49 그대로
- [ ] Demo 5게임 1라운드씩 무이상

### Risk

- `useGameWallet.refund`는 PR1에서 이미 meta 지원. meta 없이 호출하면 legacy local cache fallback (gap window) — PR2 후로는 모든 call site meta 부착이라 fallback 미진입.
- Crash applySeed의 nonce: 현재 `nonce` (store top) 사용 가능하지만 betting phase 중 nonce가 active와 동일하므로 `ar.nonce` 명시 안전.
- Unmount effect는 fire-and-forget. RPC idempotent (same roundId) — 사용자가 빠르게 mount/unmount 반복해도 서버에서 1회만 적용.

### Out of scope (defer)

- Path A hotfix · hold-to-confirm 350ms (L-3) · Mines 812 refactor · Plinko · orphan debit reconciliation · HistoryPillStrip Dice 'x' bug.
