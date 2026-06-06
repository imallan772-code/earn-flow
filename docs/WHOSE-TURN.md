# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-06)

| | |
|---|---|
| **지금** | 🤖 **Lovable AI** — **ROUND P** (Realtime feed, v2.2) |
| **당신** | Lovable에 v2.2 § P plan 붙여서 빌드 지시 |
| **Cursor** | P push 전까지 **대기** · 병렬 가능: game session hardening |

### ROUND O 완료 (Cursor sanitation ✅)

- Lovable `8013697`: GameLobby 74줄 + GameCard3D/GameMiniStats, LiveBetsVirtualList (react-window)
- Cursor: game session stake-resume wiring, walletErrors, remove useUnmountRefund, lint/prettier fixes
- LiveBetsStore/useTilt **0-diff** · AC-O-12 GameLobby ≤120 ✅

### ROUND N 완료 (Cursor sanitation ✅)

- Lovable `8dd2ec6`: MinesScreen 814→388, MinesDisplay/Controls/useMinesLifecycle
- Cursor: live feed settle in lifecycle, crash instant cashout, M backlog merge

---

## 전체 큐

```text
[완료] L-2 · M · L-3+L1-E · N (Mines) · O (Lobby react-window)
[지금] Lovable → P (Realtime feed, v2.2)
[병렬] Cursor → game session hardening
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-06 | **O 완료** → Lovable P · Cursor game session hardening |
| 2026-06-06 | **N 완료** → Lovable O · Cursor P 병렬 가능 |
