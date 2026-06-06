# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-06)

| | |
|---|---|
| **지금** | 🔧 **Cursor** — Supabase hardening Part 1–4 완료 · Lovable 대기 |
| **당신** | Part 5 (dashboard leaked-password) 또는 ROUND Q 지시 |
| **Cursor** | **Hardening Part 1–4** ✅ · check GREEN 확인 중 |

### ROUND P-PR1 완료 (Cursor)

- `live_bets` table + game_rounds trigger + Realtime publication
- `lib/api/liveFeed.ts` + `liveBetsRealtimeAdapter` (additive merge, bot 0-diff)
- `VITE_LIVE_FEED_REALTIME` flag (default ON, `false`로 dev disable)

### ROUND P-PR2 완료 (Cursor sanitation ✅)

- Lovable `9769da3`: 5× RightRail dock, `feedFilter.ts`, ME glow/pulse, filter chips (global feed only)
- Cursor: lint:strict 0 · check **152/152** GREEN · Red Lines 0-diff 확인

### ROUND O 완료 (Cursor sanitation ✅)

- Lovable `8013697`: GameLobby + LiveBetsVirtualList (react-window)
- Cursor: game session stake-resume · walletErrors · `761c27f`

---

## 전체 큐

```text
[완료] … · P-PR2 (Feed dock) · P-PR1 (Realtime additive merge)
[지금] Lovable → Q polish 또는 v2.2 후속 · Cursor 대기
[다음] Q-PR1 (/fair/verify + SHA256)
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-06 | **P-PR1 완료** → Lovable Q 또는 후속 |
| 2026-06-06 | **P-PR2 완료** → Cursor P-PR1 |
| 2026-06-06 | **O 완료** → Lovable P · Cursor game session hardening |
| 2026-06-06 | **N 완료** → Lovable O · Cursor P 병렬 가능 |
