# Lovable 라운드 종료 보고 템플릿

라운드 완료 시 Lovable이 아래 형식으로 보고한다.

```markdown
## 라운드 [P번호/이름] 완료 보고

### 변경 파일

- (신규 N / 수정 M 목록)

### 비대상 준수

- [ ] walletStore 스키마 변경 없음
- [ ] supabase/ 변경 없음
- [ ] integrations/supabase 변경 없음
- [ ] 명시적 비대상 항목 미포함

### 게이트

- eslint: GREEN / RED (경고 수: )
- vitest: GREEN / RED ( tests)
- build: GREEN / RED

### 수동 회귀

- (해당 시: Crash nonce / Dice history / Mines settle 등)

### TODO → Cursor

- (DB/RPC 필요 항목 목록, 없으면 "없음")
```
