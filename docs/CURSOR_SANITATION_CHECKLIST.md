# Cursor Sanitation Checklist (pull 후 15분)

Lovable push → `git pull` 직후 실행.

## 1. 자동 게이트

```bash
bun run check
```

## 2. grep 감사

```bash
rg "wallet\.(credit|tryDebit)" src/mocks src/features --glob "!*Screen*"
rg "MOCK_BALANCE" src/features
rg "\.rpc\(" src/features
rg "from\(" src/features --glob "*Screen*"
rg "liveBets:\s*\d+" src/features
```

## 3. PASS/FAIL

| # | 검사 | FAIL 조치 |
|---|------|-----------|
| 1 | mock/useEffect에서 wallet 호출 | 제거, useGameWallet |
| 2 | MOCK_BALANCE money fallback | loading/unauth |
| 3 | Screen 200줄+ Plinko 패턴 | 셸 분리 |
| 4 | 인라인 mock | src/mocks/ 이동 |
| 5 | gameRegistry 미등록 | registry 등록 |
| 6 | Lovable이 supabase/ 수정 | 재검증 |
| 7 | bun run check RED | Cursor 수정 |

## 4. 수동 회귀 (해당 라운드만)

- Crash/Dice: nonce, history, 잔액, 새로고침 복원
- Mines: reveal → cashout/mine-hit settle

## 5. Supabase 트리거

`.rpc(` 신규, real money TODO, types 불일치 → `SUPABASE_AUTOMATION_RULES.md` 실행
