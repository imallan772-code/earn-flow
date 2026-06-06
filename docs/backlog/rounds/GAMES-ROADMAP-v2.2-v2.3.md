# Stake/Rollbit Parity Roadmap v2.2 / v2.3 (SSOT)

| 항목 | 값 |
| ---- | -- |
| **상태** | 📋 계획 확정 — **v2.1 폴리시 큐(M→N→O)와 병렬 가능** |
| **작성일** | 2026-06-06 |
| **관계** | v2.1 = 7종 demo 폴리시 · v2.2/v2.3 = Stake/Rollbit **압살** 레이어 |

> **ROUND M은 v2.1 한 칸일 뿐.** 본 문서 항목은 M scope **밖**. M Non-goal SSOT.

**차례 SSOT:** [`docs/WHOSE-TURN.md`](../../WHOSE-TURN.md)

---

## v2.1 잔여 (Lovable — 끊지 말 것)

```text
[지금] M (Plinko) → [선택] L-3+L1-E → N (Mines 분리) → O (Lobby react-window)
```

| 라운드 | Owner | SSOT |
|--------|-------|------|
| M | Lovable | `GAMES-ROADMAP-v2.1.md` § M |
| L-3+L1-E | Lovable | `CURSOR_AUDIT_NOTES.md` L1-D, L1-E |
| N | Lovable | v2.1 § N |
| O | Lovable | v2.1 § O |

---

## v2.2 — Stake 첫인상 트랙 (Cursor 주도, Lovable UI 일부)

**목표:** mocks/FOMO demo feed → **실제 Realtime + 신뢰 + 입금 UX shell**

| ID | 라운드 | Owner | Scope | 왜 |
|----|--------|-------|-------|-----|
| **P** | Realtime Live Feed | ⚙️ Cursor (+ Lovable hookup) | Supabase Realtime channel, `live_bets` 또는 game_events 테이블, 우측 dock/Feed 연동 | Stake/Rollbit 첫인상 ~70%. 현재 `LiveBetsStore` + bot = **demo FOMO only** |
| **Q** | PF 외부 Verify | ⚙️ Cursor (+ Lovable page polish) | Standalone route `/fair/verify`, SHA256 재현, server seed commit 공개 | Modal만으로는 SEO·신뢰 부족 |
| **R** | Cashier shell | 🤖 Lovable UI + ⚙️ Cursor money | Deposit modal, network 선택, QR placeholder — **RPC/잔액 mutation 없음** | Real money 진입 UX |

### P — Realtime Live Feed (상세)

**Cursor (PR1):**

- Supabase: table + RLS + Realtime publication (phonara-gb)
- `lib/api/liveFeed.ts` + types regen
- `LiveBetsStore` adapter: bot demo **유지** + real channel merge (feature flag)

**Lovable (PR2, optional):**

- Feed UI polish, ME row, filter, desktop RightRail dock

**Non-touch Lovable P-PR2:** `supabase/`, `lib/api/`

### Q — Provably Fair Verify Page

- Public page: client seed + nonce + server seed hash → outcome 재현
- Edge Function or static WASM for heavy games (Plinko path precompute)
- SEO meta + share link

### R — Cashier Shell

- Lovable: modal UI, network chips, QR mock
- Cursor: `debit`/`credit` wiring은 **별 라운드** (money-safety)

---

## v2.3 — Rollbit 압살 트랙 (큰 라운드, 별도 plan 필수)

| ID | 항목 | Owner | 현재 | 비고 |
|----|------|-------|------|------|
| **S** | Crash 멀티플레이어 | Cursor + Lovable | 솔로 4-phase | 실시간 다중 cashout 곡선, shared round |
| **T** | Race / Wager / Rakeback | Cursor | 없음 | retention + 매출 구조 |
| **U** | Tip / Rain / Vault | Cursor + Lovable UI | 없음 | Stake 소셜 머니 흐름 |
| **V** | Originals +5 | Lovable | 7종 고정 | Keno, HiLo, Tower, Slide, Blackjack 등 |

### v2.3 추가 (로드맵만, 라운드 미배정)

| # | 항목 | Owner |
|---|------|-------|
| 8 | Cashier full (on-ramp RPC) | Cursor |
| 9 | Mobile sticky bet bar + landscape chart | Lovable |
| 10 | Search / Recently / Favorites / Provider filter | Lovable (O 확장) |

---

## M과의 관계 (Non-goal — Lovable M plan에 붙일 문구)

```text
Stake/Rollbit parity 항목(Realtime feed, Race, Vault, PF standalone, Crash MP,
VIP/Rakeback, Originals 확장, Cashier)은 v2.2/v2.3 Cursor 트랙.
ROUND M = Plinko 시각·5공 큐·SFX·공통 인프라만.
```

---

## 추천 착수 순서 (v2.1과 병렬)

```text
v2.1:  M ──→ L-3/E ──→ N ──→ O          (Lovable 연속)
v2.2:  P (Realtime) ──→ Q ──→ R          (Cursor, M merge 후 P 착수 가능)
v2.3:  S ──→ T ──→ U ──→ V              (별도 승인 후)
```

**P는 M과 파일 충돌 거의 없음** — Cursor가 M Lovable 진행 중 병렬 설계 가능.  
**PR merge 순서:** v2.1 라운드 sanitation GREEN 유지 후 v2.2 PR merge.

---

## Stake/Rollbit gap 테이블 (정직 SSOT)

| # | 항목 | v2.1 | v2.2 | v2.3 |
|---|------|------|------|------|
| 1 | Realtime Live Feed | mocks | **P** | |
| 2 | High-roller / Race / Wager | | | **T** |
| 3 | Vault / Tip / Rain | | | **U** |
| 4 | PF standalone verify | Modal | **Q** | |
| 5 | Crash multiplayer | 솔로 | | **S** |
| 6 | VIP / Rakeback / Bonuses | | | **T** |
| 7 | Originals +5 | 7종 | | **V** |
| 8 | Cashier deposit | | **R** (shell) | full |
| 9 | Mobile sticky bet bar | | | Lovable |
| 10 | Lobby search/favorites | O partial | | O+ |

---

## 변경 이력

| 버전 | 날짜 | 내용 |
| ---- | ---- | ---- |
| v2.2/v2.3 | 2026-06-06 | Stake/Rollbit parity 트랙 분리 · M Non-goal 명시 |
