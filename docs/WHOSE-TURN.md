# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-06)

| | |
|---|---|
| **지금** | ⚙️ **Cursor** — **ROUND P-PR1** (Supabase Realtime + `lib/api/liveFeed.ts` + Store adapter) |
| **당신** | Cursor PR1 착수 · Lovable **대기** (P-PR2 완료) |
| **Lovable** | P-PR2 완료 (`9769da3`) · 다음 Q polish 또는 v2.2 후속 |

### ROUND P-PR2 완료 (Cursor sanitation ✅)

- Lovable `9769da3`: 5× RightRail dock, `feedFilter.ts`, ME glow/pulse, filter chips (global feed only)
- Cursor: lint:strict 0 · check **152/152** GREEN · Red Lines 0-diff 확인

### ROUND O 완료 (Cursor sanitation ✅)

- Lovable `8013697`: GameLobby + LiveBetsVirtualList (react-window)
- Cursor: game session stake-resume · walletErrors · `761c27f`

---

## 전체 큐

```text
[완료] L-2 · M · L-3+L1-E · N · O · P-PR2 (Feed dock + filter + ME row)
[지금] Cursor → P-PR1 (Supabase Realtime + adapter)
[다음]  Q-PR1 (/fair/verify) 또는 Lovable Q polish
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-06 | **P-PR2 완료** → Cursor P-PR1 |
| 2026-06-06 | **O 완료** → Lovable P · Cursor game session hardening |
| 2026-06-06 | **N 완료** → Lovable O · Cursor P 병렬 가능 |
