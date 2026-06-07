# 플랫폼 출시 전 체크리스트

**대상:** earn-flow / phonara-gb (`kanftnqenuzverroodev`)  
**지금(로컬):** `localhost:8080` + RP ID `localhost` — 개발 전용  
**출시 시:** 아래 항목을 **도메인 확정 후** 순서대로 진행

> 도메인 예시는 `phonara.app` — 실제 구매한 도메인으로 바꿀 것.

---

## 0. 출시 전에 확정할 것

- [ ] **프로덕션 도메인** (apex vs `www` vs `app.` 중 메인 URL 하나)
- [ ] **스테이징 도메인** (선택, 예: `staging.phonara.app`)
- [ ] **호스팅** (Cloudflare Pages / Vercel 등) + **HTTPS** 자동 발급
- [ ] **RP ID는 한 번 정하면 거의 못 바꿈** — 패스키가 전부 무효화됨

---

## 1. 도메인 · DNS · HTTPS

- [ ] 도메인 구매 및 DNS → 배포 타겟 연결
- [ ] 프로덕션 **HTTPS** 확인 (패스키·OAuth 필수)
- [ ] `www` ↔ apex 리다이렉트 정책 결정
- [ ] 배포 환경 변수에 `VITE_SITE_URL=https://phonara.app` 설정

---

## 2. Supabase Auth — URL Configuration

**파일:** `supabase/config.toml` → `[auth]`  
**푸시:** `SUPABASE_ACCESS_TOKEN=sbp_xxx bun run supabase:config:push`  
**동기화:** `scripts/push-supabase-auth-config.ts` 의 `AUTH_PATCH`도 같은 값으로 수정

```toml
[auth]
site_url = "https://phonara.app"
additional_redirect_urls = [
  "https://phonara.app/**",
  "https://www.phonara.app/**",
  # 스테이징 사용 시
  # "https://staging.phonara.app/**",
]
```

- [ ] Dashboard **Authentication → URL Configuration** 과 값 일치 확인
- [ ] 이메일 확인·비밀번호 재설정·OAuth 리다이렉트가 **프로덕션 URL**로 가는지 테스트

---

## 3. 패스키 (WebAuthn) — 프로덕션 연결

로컬 `localhost` 패스키는 **프로덕션에서 사용 불가**. 출시 후 사용자는 **다시 등록**.

**파일:** `supabase/config.toml` → `[auth.passkey]`, `[auth.webauthn]`

```toml
[auth.passkey]
enabled = true

[auth.webauthn]
rp_display_name = "PHONARA"
rp_id = "phonara.app"   # scheme·port·path 없이 도메인만
rp_origins = [
  "https://phonara.app",
  "https://www.phonara.app",
  # 최대 5개 — 스테이징 포함 시 여기 추가
]
```

**`scripts/push-supabase-auth-config.ts` 예시 (출시 시 교체):**

```ts
site_url: "https://phonara.app",
uri_allow_list: "https://phonara.app/**,https://www.phonara.app/**",
webauthn_rp_id: "phonara.app",
webauthn_rp_origins: "https://phonara.app,https://www.phonara.app",
```

- [ ] `bun run supabase:config:push` 실행
- [ ] 프로덕션에서: 이메일 가입 → **프로필 → 패스키 등록** → 로그아웃 → 패스키 로그인 E2E
- [ ] 앱은 이미 `@supabase/supabase-js` 2.105+ + `experimental.passkey` (`src/integrations/supabase/client.ts`)

---

## 4. 이메일 · 가입 정책

**개발(현재):** `enable_confirmations = false`, `mailer_autoconfirm: true`  
**출시 권장:**

- [ ] `supabase/config.toml` → `[auth.email] enable_confirmations = true`
- [ ] `scripts/push-supabase-auth-config.ts` → `mailer_autoconfirm: false` (또는 Dashboard에서 Confirm email ON)
- [ ] **Custom SMTP** 설정 (Dashboard → Authentication → Emails) — Supabase 기본 메일은 한도·스팸 이슈
- [ ] 템플릿 점검: Confirm sign up, Reset password
- [ ] (선택) Security 알림 ON — 비밀번호 변경, 패스키/로그인 수단 연결 등

---

## 5. OAuth · 소셜 로그인

**구글 (코드 준비됨 — `AuthShell` + `signInWithGoogle`):**

- [ ] Google Cloud Console → OAuth 클라이언트 (Web)
- [ ] Authorized redirect URI: `https://kanftnqenuzverroodev.supabase.co/auth/v1/callback`
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` → 배포 secrets + 로컬 `.env`(gitignore)
- [ ] `supabase/config.toml` → `[auth.external.google] enabled = true`
- [ ] `bun run supabase:config:push`

**휴대폰 OTP:** UI만 있음 — Provider + Twilio 등 별도 작업 (`LATER.md` 참고)

---

## 6. Admin · 보안 플래그

- [ ] **`VITE_ADMIN_DEV_OPEN=false`** (프로덕션 빌드 — 절대 true 금지)
- [ ] **`VITE_ADMIN_ENABLED`** — 공개 전까지 `false`, 준비되면 `true`
- [ ] `admin_users`에 운영자 UUID 등록 (가입 후 Dashboard SQL 또는 MCP)
- [ ] `apps/admin` 스탠드얼론 배포 URL을 Supabase redirect 목록에 추가 (별도 도메인 사용 시)
- [ ] `bun run check` GREEN + Supabase `get_advisors` 보안 WARN 재점검
- [ ] Money v2 soak test 완료 (`docs/backlog/LATER.md` P0)

---

## 7. 배포 환경 변수 (프로덕션)

```env
VITE_SUPABASE_URL=https://kanftnqenuzverroodev.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable/anon>
VITE_SITE_URL=https://phonara.app
VITE_ADMIN_ENABLED=false
VITE_ADMIN_DEV_OPEN=false
# VITE_MONEY_RPC_V2=true  # soak GREEN 후
```

**서버 전용 (클라이언트 노출 금지):**

```env
SUPABASE_SERVICE_ROLE_KEY=...
```

- [ ] `.env.example` 주석과 실제 배포 secrets 일치
- [ ] `service_role` / PAT / Google secret 이 Git·프론트 번들에 없는지 확인

---

## 8. 출시 직전 QA (Auth)

| 시나리오                               | 확인 |
| -------------------------------------- | ---- |
| 이메일 가입 → 온보딩 → 10,000 PHON     | ⬜   |
| 이메일 로그인 / 로그아웃               | ⬜   |
| 비밀번호 재설정 메일 → 링크 → 로그인   | ⬜   |
| 프로필에서 패스키 등록 → 패스키 로그인 | ⬜   |
| 구글 로그인 (Provider ON 후)           | ⬜   |
| Admin — `admin_users`만 `/admin` 접근  | ⬜   |

---

## 9. 출시 당일 순서 (권장)

1. 도메인 DNS + HTTPS LIVE
2. `config.toml` + `push-supabase-auth-config.ts` 프로덕션 값으로 수정
3. `bun run supabase:config:push`
4. 배포 env 설정 후 프로덕션 빌드·배포
5. 위 QA 표 전부 GREEN
6. (선택) 스테이징에서 먼저 1~5 반복

---

## 관련 파일

| 파일                                    | 역할                                             |
| --------------------------------------- | ------------------------------------------------ |
| `supabase/config.toml`                  | Auth URL · Passkeys · Providers SSOT (로컬 편집) |
| `scripts/push-supabase-auth-config.ts`  | 원격 phonara-gb에 auth 설정 푸시                 |
| `src/lib/auth/redirect.ts`              | `emailRedirectTo` / OAuth `redirectTo`           |
| `src/integrations/supabase/client.ts`   | Passkey experimental opt-in                      |
| `src/features/auth/AuthShell.tsx`       | 로그인 UI                                        |
| `src/features/auth/PasskeySettings.tsx` | 프로필 패스키 등록/삭제                          |
| `src/integrations/supabase/README.md`   | 로컬 Supabase 연동 요약                          |
| `docs/SUPABASE-PROJECT-LOCK.md`         | phonara-gb only                                  |

---

---

## 10. Game Authority 운영 인프라 (GA-M plan §15)

### 10.1 월간 시드 공개 (PF 신뢰)

- [ ] `audit_export_month_v1` RPC → `/audit/{yyyy-mm}.json` 엔드포인트 운영 스케줄 설정
- [ ] 외부 검증자용 문서 공개 (PF 검증 방법 + seed 해석 가이드)
- 트랙: **코드** (GA-K RPC 완료, 운영 스케줄만)

### 10.2 KYC/AML 인프라

- [ ] real mode 대규모 활성화 전 KYC 프로바이더 연동
- [ ] 출금 한도별 KYC 레벨 정책 확정
- [ ] AML 스크리닝 워크플로우
- 트랙: **별도 PR / 외부 연동**

### 10.3 출금 SLA

- [ ] 출금 처리 SLA 24시간 이내 정책 확정
- [ ] 출금 큐 모니터링 대시보드
- [ ] SLA 위반 시 자동 알림
- 트랙: **정책 + 모니터링**

### 10.4 CS/신고 티켓 시스템

- [ ] 사용자 신고/CS 티켓 도구 도입 (Zendesk / 자체 등)
- [ ] refund 시도 패턴 모니터링 (abuse 탐지)
- 트랙: **운영 도구**

### 10.5 Daily Metric Slack Alarms

- [ ] `reconciliation_alerts` (24h): 0건 아니면 즉시 freeze
- [ ] `pf_degrade_audit` L2/L3 events: 0건 아니면 즉시 검토
- [ ] auto-bet active sessions 추세 모니터링
- [ ] Edge Function p95/p99 latency 대시보드
- [ ] Crash force-settle count 비정상 spike 감시
- 트랙: **GA-M-ops 연계**

### 10.6 Insurance Fund (대형 페이아웃 대비)

- [ ] 보험 기금 규모 결정 (월 예상 매출 대비 %)
- [ ] 대형 페이아웃 (예: 10,000+ PHON) 발생 시 알림 + 수동 검토 트리거
- 트랙: **재무/정책**

### 10.7 로그 보관 정책

- [ ] `game_rounds`, `pf_sessions`, `reconciliation_alerts` 보관 기간 확정
- [ ] `pf_degrade_audit` 감사 로그 무기한 보관
- [ ] GDPR/개인정보 규정 대응 (해당 시)
- 트랙: **인프라**

---

## 메모

- **로컬 dev:** 항상 `http://localhost:8080` 하나만 (`bun run dev` 중복 실행 금지)
- **패스키 RP ID 변경 = 기존 패스키 전원 재등록**
- 출시 도메인 정해지면 이 문서의 `phonara.app`를 일괄 치환하고 PR에 포함
