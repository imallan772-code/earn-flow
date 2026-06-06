# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-06)

| | |
|---|---|
| **지금** | 🤖 **Lovable AI** — Q-c polish (Fair modal → `/fair/verify` 링크) 또는 R Cashier UI |
| **당신** | Part 5 dashboard (leaked password) · Q-c/Lovable 지시 |
| **Cursor** | **Supabase Hardening 1–4** ✅ · **Q-PR1a/b** ✅ pushed |

### Supabase Hardening 완료 (Cursor)

- Part 1–4 migrations + `docs/SUPABASE_HARDENING_ROADMAP.md`
- RPC anon surface closed · money v1 deprecated · live_bets column privacy
- Commit `9cc3775` on `main`

### ROUND Q-PR1 완료 (Cursor)

- `/fair/verify` public route — SHA256 commit + 5-game outcome re-derive
- `src/lib/pf/verifyPublic.ts` + vitest
- SSOT: `docs/ROUND-Q-PR1.md`

### ROUND P-PR1 완료 (Cursor)

- `live_bets` table + game_rounds trigger + Realtime publication
- `lib/api/liveFeed.ts` + `liveBetsRealtimeAdapter` (additive merge, bot 0-diff)

---

## 전체 큐

```text
[완료] P-PR1 · P-PR2 · Supabase Hardening 1–4 · Q-PR1a/b
[지금] Lovable → Q-c polish 또는 R Cashier shell
[다음] R-PR1 Cashier (Lovable UI + Cursor money wiring 별도)
[수동] Supabase Part 5 — leaked password protection
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-06 | **Q-PR1 + Hardening** → Lovable Q-c / R |
| 2026-06-06 | **P-PR1 완료** → Cursor hardening |
| 2026-06-06 | **P-PR2 완료** → Cursor P-PR1 |
