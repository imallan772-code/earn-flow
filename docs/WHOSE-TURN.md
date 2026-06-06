# 지금 누구 차례? (SSOT)

**헷갈릴 때 이 파일만 본다.** 매 라운드 종료 시 Cursor가 `현재 차례` 한 줄을 갱신한다.

---

## 🔴 현재 차례 (2026-06-07)

| | |
|---|---|
| **지금** | 👤 **당신** — 홍보 전 수동 설정 → [`docs/PROMO_LAUNCH_CHECKLIST.md`](./PROMO_LAUNCH_CHECKLIST.md) |
| **Cursor** | **Q-c sanitation** ✅ `routeTree.gen.ts` Register 복원 |
| **Lovable** | **ROUND Q-c** ✅ PF modal → `/fair/verify` prefill + i18n (`fd208bf`) |

### ROUND Q-c (Lovable v1.2 + Cursor sanitation)

- `PfVerifyPageLink` — 5게임 PF 모달 footer CTA · `hash` prefill · commit 전 disabled
- `FairVerifyScreen` — `t("fair.verify.*")` i18n SSOT
- Promo GATE-2 · verifyPublic/Modal/Engine 변경 0

### ROUND Z-5 (Promo — 완료)

- ChannelMatrix OAuth 3-state · Analytics dual sparkline · vitest promo 95/95
- Cursor: `usePromoAdmin` analytics `queryFn` sig (`101eba5`)

---

## ROUND Z 큐

```text
[완료] Z-0 · Z-DB · Z-1 · Z-SWAP · Z-2 · Z-3 · Z-4 · Z-OAuth · Z-5
[지금] 수동 → `docs/PROMO_LAUNCH_CHECKLIST.md` (OAuth keys · pg_cron · smoke)
[대기] Z-6+ — 백엔드 필요 시 Cursor가 새 라운드 정의
```

## ROUND Q 큐

```text
[완료] Q-PR1 (verify lib + /fair/verify page) · Q-c (modal CTA + i18n)
[대기] Q-d Plinko verify (deferred)
```

---

## 변경 이력

| 날짜 | 현재 차례 |
|------|-----------|
| 2026-06-07 | **Q-c 완료** → 수동 PROMO_LAUNCH_CHECKLIST |
| 2026-06-07 | **Z-5 완료** → Lovable Q-c |
| 2026-06-07 | **Z-OAuth 완료** → Lovable Z-5 |
| 2026-06-07 | **Z-4 완료** → Cursor Z-OAuth |
