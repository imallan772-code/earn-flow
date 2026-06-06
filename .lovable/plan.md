# ROUND L-3 + L1-E — Small PR (1 PR 묶기)

**SSOT**: `docs/CURSOR_AUDIT_NOTES.md` (L1-D, L1-E) + `docs/WHOSE-TURN.md`
**Non-goal**: ROUND N (Mines 분리), v2.2/v2.3 (Realtime/Race/Vault) — 본 PR은 두 hotfix만.

---

## 🔴 레드라인

- `CrashEngine.ts` / `usePlinkoRound` / `StakeBetPanel` 0-diff
- `supabase/`, `src/integrations/supabase/types.ts`, `src/lib/api/`, `walletStore` schema 0-diff
- 신규 npm 의존성 금지
- `HistoryPillStrip` **공용 API 호환 유지** (Crash/Wheel/Limbo 사용 중 — props 추가만, 기존 호출부 0-diff)

---

## 스코프

### L-3 — Crash hold-to-confirm 150→350ms

**파일**: `src/features/games/crash/CrashScreen.tsx`

- `HOLD_CONFIRM_MS = 150` → `350`
- `BetSummaryPanel` 자체는 0-diff (`holdMs` prop 그대로 전달)

**문구 동기화**: `src/shared/games/rules/gameRules.ts`
- CRASH_RULES 단축키 body: `"150ms 길게 눌러 확정"` → `"350ms 길게 눌러 확정"`

### L1-E — HistoryPill Dice "x" 의미 버그

**문제**: Dice는 `roll` 값(0.00–99.99)을 `multiplier`로 넘기고 있어 strip에 "73.42x" 처럼 배수가 아닌 값에 `x` 접미사가 붙음.

**해결 방향**: `HistoryPillStrip` 에 표시 모드 prop 추가 (게임별 의미 분리)
- `displayMode?: "multiplier" | "value"` (default `"multiplier"` — 기존 동작 유지)
- `value` 모드: 접미사 없음, 색상 티어는 win/loss 기반 (별도 prop)
- `HistoryPillItem` 에 `won?: boolean` optional 추가 — Dice에서 사용

**파일**:
- `src/shared/games/ui/HistoryPillStrip.tsx` — props 확장, 기존 호출부 호환
- `src/features/games/dice/DiceScreen.tsx` — strip 호출에 `displayMode="value"` + `won` 전달

**Crash/Wheel/Limbo**: 호출부 0-diff (기존 `multiplier` 모드 유지)

---

## ✅ Acceptance Criteria

- **AC-L3-1**: Crash betting → 캐쉬아웃 hold 350ms 진행 후 확정 (탭/짧은 클릭은 무시)
- **AC-L3-2**: gameRules.ts CRASH_RULES 단축키 문구 "350ms" 동기화
- **AC-L1E-1**: Dice history pill — roll 값 표시, **`x` 접미사 없음**, win=cyan/gold/rose tier, loss=muted
- **AC-L1E-2**: Crash/Wheel/Limbo history pill 시각·동작 회귀 0
- **AC-shared**: `HistoryPillStrip` 기존 props (`items`/`onPillClick`/`className`) 호환

---

## 🚪 Exit Gate

- `bun run lint:strict` — 0 warn
- `bun run check` — GREEN
- 수동 QA: Crash 짧은 탭 무시 / 350ms hold OK / Dice over+win → 색상+숫자 / Dice loss → muted

---

## 📋 보고

`docs/lovable/ROUND_REPORT_TEMPLATE.md` 양식. 말미에 "Cursor 차례" 명시.

---

## Post-L-3 큐 (참고)

```text
[지금]   Lovable  → L-3 + L1-E   ← 진행
[다음]   Cursor   → sanitation
[그다음] Lovable  → ROUND N (Mines 분리)
[그그]   Lovable  → ROUND O (react-window)
[병렬]   Cursor   → ROUND P (Realtime, v2.2)
```
