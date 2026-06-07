# PHONARA Game Authority — 최종 지존급 플랜 v3 FINAL

> **본 문서가 SSOT (Single Source of Truth)**. 이전 버전(v1 Overhaul, v2 통합본, v3 PATCH)은 본 문서로 대체.
>
> **타겟**: 한국 시장 출시 전. 1인 작업자(쩡팀장) + AI 어시스턴트.
>
> **목표**: Stake.com / Rollbit를 **정확도·검증가능성·자동베팅 권위·모바일 부드러움** 4축에서 동급 이상.
>
> **저장 위치**: `docs/PHONARA-GAME-AUTHORITY-PLAN-v3-FINAL.md` (레포 SSOT).
>
> **완료 보고서**: `docs/PHONARA-GAME-AUTHORITY-COMPLETION-REPORT.md` (PR 단위 섹션).

---

## 0. 4축 목표 (production-ready 정의)

| 축 | 기준 | 완료 조건 |
|---|---|---|
| 정확도 | Stake/Rollbit 동급 | 실효 RTP 99.0% ± 0.3%, 페이아웃 1 PHON 오차 0 |
| 검증가능성 | 진짜 Provably Fair | commit/reveal 시드 회전 + 외부 검증 코드 1000라운드 100% 일치 |
| 자동베팅 | 서버 권위 | 탭 닫아도 실행, 전략 서버 SSOT, 1년 시점 22,500 동시 세션 처리 |
| 부드러움 | 60fps UX | warm settle p95 < 150ms, cold 포함 p95 < 250ms (GA-E 실측 후 확정) |

---

## 1. 핵심 설계 결정 (변경 불가)

### 1.1 데모 = 리얼 동형 설계

데모는 "가짜 RTP"가 아니라 리얼과 동일한 베팅·정산·자동베팅·세션복원 경험을 제공한다.

```typescript
// ModeContext — 최종값
export const RTP: Record<GameMode, number> = {
  demo: 1.00,   // 엔진 99%만 적용 (추가 차감 없음)
  real: 1.00,
};
```

- **차이점은 오직 지갑 소스**: demo = `walletStore` local grant / real = Supabase RPC
- **동일**: `houseEdge.settlementPayout`, nonce 정책, session resume, auto-bet 파라미터, PF 모달, Edge Function 호출
- **라벨**: "데모 · RTP 99%" / "리얼 · RTP 99%" (동일 수치, 모드만 구분)
- **모드 결정**: 서버 결정 (클라 입력 무시) — §6.4 참조

### 1.2 이탈/새로고침 = 환불 금지 (악용 방지 SSOT)

```
이탈/새로고침 → 세션 유지 → 복귀 → 서버/클라 자동 정산 → clearRealSession
```

- `beforeunload` / `unmount` / `route-change` → `refund()` 호출 금지
- `refund_phon_for_bet_v2`는 active `game_active_sessions` 존재 시 서버에서 거부
- Plinko 큐 미처리 = 환불이 아닌 **서버 auto-release + settle**

### 1.3 금액 정밀도 — 단계적 micro-PHON 마이그레이션

| 주차 | 금액 레이어 |
|---|---|
| W1~W3 | 기존 integer PHON + 단일 SSOT (`settlementPayout` / SQL `compute_payout_phon`) — demo/real 동일 공식 |
| W4 GA-K | micro-PHON (1e6) + `multiplier_e6` 마이그레이션 + reconciliation trigger |

W1부터 `supabase/functions/_shared/money.ts`에 `computePayout` pure 함수 도입 → 클라/SQL/Edge 단일 공식.

### 1.4 기존 인프라 재활용 (greenfield 금지)

- `game_active_sessions` (이미 존재) → 세션 resume SSOT 유지
- `game_rounds` → GA-A 이후 `pf_session_id`, `bet_params`, `multiplier_e6` 컬럼 `ADD COLUMN IF NOT EXISTS`
- `money_idempotency_ledger` → W4에서 통합 검토
- `pf_hmac_bytes` / `mines_next_multiplier` (이미 SQL) → Edge Function 공유 모듈로 포팅

---

## 2. 현재 코드 갭 (감사 확정)

| 문제 | 심각도 | 담당 PR |
|---|---|---|
| 이중 RTP 96.03% | CRITICAL | GA-B |
| Mines cashout 클라 신뢰 | CRITICAL | GA-D |
| Plinko PF 허위표시 (mulberry32 + HMAC UI) | LEGAL | GA-C |
| 하드코딩 SERVER_SEED 6게임 | HIGH | GA-A |
| 클라이언트 outcome 계산 5게임 | HIGH | GA-E~I |
| Dice 세션복원 없음 + bettingRoundKey 누락 | HIGH | GA-F + hotfix |
| Auto-bet 클라 only (탭 닫으면 중단) | MEDIUM | GA-J |
| TODO(real-money) 14건 | BLOCKER gate | GA-E~I |
| Crash 무한 active 라운드 위험 | HIGH | GA-E (timeout 정책) |
| Edge Function mode 클라 입력 신뢰 | SECURITY | GA-A (resolveMode 도입) |

---

## 3. PR 로드맵 (GA-0 ~ GA-K)

### W1 — 즉시 패치 + 기반 (BLOCKER)

#### GA-0: Resume-First Anti-Abuse (0.5d)
- `src/shared/games/resumePolicy.ts` 신규 — `refundOnUnmount: false` SSOT
- 게임별 정산 정책 코드 주석 + 타입 고정 (§5 참조)
- 마이그레이션: `refund_phon_for_bet_v2`가 active session 존재 시 거부
- PR 체크리스트: "unmount refund 추가 금지" 명시

#### GA-B: RTP 이중 적용 제거 (0.5d)
- `ModeContext.tsx`: `demo: 1.00, real: 1.00`
- `houseEdge.ts` 주석/테스트 갱신
- 6게임 × 100k 시뮬 → 99.0% ± 0.3% 검증

#### GA-C: Plinko PF 모달 정직화 (0.25d, 법적 리스크 즉시)
- `PlinkoScreen.tsx`: HMAC 문구 제거, "PF v2 마이그레이션 중" 임시 표기
- GA-I 완료 시 HMAC 문구 복구

#### GA-D: Mines cashout 서버 재계산 (0.5d)
- `mines_cashout_v1`: `p_gross_payout` 제거 → `mines_cashout_v2(round_id, idempotency)` 신설
- 서버: `bet_amount × mines_next_multiplier(revealed, mines)` → `credit_phon_for_payout_v2`
- `minesSession.ts`: `cashoutMinesRound(roundId)` only
- v1 deprecate → 1주 후 drop

#### Hotfix (GA-F 선행, 0.25d)
- Dice `bettingRoundKey={nonce}` 누락 수정
- `AutoBetConfigFields`: `numberOfBets` 필드 추가

#### GA-A: PF 세션 회전 + user_settings 통합 (2.5d)
- `pf_sessions` 테이블 + `pf_session_create_or_get_v1` / `pf_session_rotate_v1`
- active 라운드 있으면 rotate 금지 (`pfPolicy.ts` 연동)
- `supabase/functions/_shared/pf.ts` — Stake HMAC (기존 `provablyFair.ts`와 byte-identical 검증)
- **`user_settings` 테이블 추가** (§6.4 mode 결정용)
- **`resolveMode()` shared module** (§6.4)
- 클라: `usePfSession` 훅 → 6게임 SERVER_SEED 상수 제거
- `/provably-fair` 검증 페이지 + 외부 JS/Python 샘플
- **anon auth 기본화** — 데모도 동일 `pf_sessions` 사용

**W1 누적: 4.5 영업일**

### W2~W3 — 서버 권위 템플릿 (7일)

#### GA-E: Crash 서버 권위화 (7d) ← 모든 게임의 복제 템플릿

```
Client → crash-place EdgeFn → DB (lock + debit + crashPoint 결정 + round insert)
Client ← {round_id, seed_hash} (crashPoint 비공개)
Client → 애니메이션 only
Client → crash-cashout EdgeFn → DB (crashPoint 검증 + credit)
Client ← {payout, revealed_crashPoint}
```

- Edge: `crash-place`, `crash-cashout`, `crash-force-settle-cron` (§5.1)
- place 시 crashPoint 서버 결정, 클라 `CrashEngine.ts`는 렌더 전용
- cashout: `at_multiplier_e6 < crash_point_e6` 서버 검증 + 시간 정합성
- **라운드 max lifetime = 60분** → 강제 settle cron (§5.1)
- 세션: 기존 `fetchRealSession` 유지, unmount refund 없음
- `feature_flag: game_authority.crash_server_settle` — 5% A/B → 24h → 100%
- **실측 latency 표 필수** (warm/cold p95/p99)

### W4~W6 — 5게임 서버 권위 롤아웃 (13일)

GA-E 템플릿 복제. 차이점만:

| PR | 게임 | 영업일 | 특이사항 |
|---|---|---|---|
| GA-F | Dice | 3d | 즉시결정(place=debit+credit atomic), session resume, nonce 서버 응답만 갱신 |
| GA-G | Limbo | 3d | 즉시결정, nonce++ place 후 서버 SSOT |
| GA-H | Wheel | 3d | MULTIPLIERS 서버 상수, 3200ms 애니 only |
| GA-I | Plinko | 4d | mulberry32→HMAC, path 서버 결정→클라 physics 보정, 큐 stale = auto-settle (refund X) |

**공통 클라이언트 규칙 (6게임)**:
- `computeRoll` / `computeCrashPoint` / `dropPath` 등 real 모드에서 호출 0회
- demo도 동일 Edge Function 호출 (지갑만 local) — 데모=리얼 체험 완성
- `syncRealSession` / `fetchRealSession` 6게임 전부
- `auto-bet betParamsGetter` → 게임 target/condition 반영

**Mines**: 이미 서버 권위(reveal/cashout). GA-D 이후 GA-A `pf_sessions` 연동만.

### W7~W8 — 서버 사이드 자동 베팅 (8일)

#### GA-J: 서버 자동 베팅 (3분할)

**J-1 (3d)**: `auto_bet_sessions` 테이블 + create/pause/resume/stop RPC
**J-2 (3d)**: `auto-bet-worker` Edge (200~500ms cron, `FOR UPDATE SKIP LOCKED`)
**J-3 (2d)**: UI — 전역 활성 세션 인디케이터, `/auto-bet` 리스트, Realtime 업데이트

**안전장치 (책임 도박 + 운영 보호)**:
- tick interval ≥ 1000ms
- **per-user 동시 active ≤ 3** (마틴게일 + 안티마틴게일 + 여유 1개)
- 일 max 10,000 rounds (운영 보호 — `daily_round_limit` default)
- 명시적 "자동 베팅 동의" 체크박스 필수
- **일일 손실 한도**: default **없음 (NULL)** — 사용자 **opt-in** 시에만 enforce (1~99% 또는 PHON 절대값)
- **연속 손실 안전판**: default **없음 (NULL)** — 사용자 **opt-in** 시 1~100 (무제한 금지)
- **자동 정지 알림**: opt-in 한도 도달 시 push + 인앱 알림

> ADR: [`docs/decisions/2026-06-08-no-default-loss-cap.md`](./decisions/2026-06-08-no-default-loss-cap.md)

클라 `useAutoBetController`는 feature_flag off 시 fallback 유지.

### W8~W9 — 페이아웃 무오차 검증 (4일)

#### GA-K: Reconciliation (4d)
- `reconciliation_alerts` 테이블
- wallet balance integrity trigger (p95 측정 후 sampling 여부 결정)
- shadow audit: payout ≥ 1000 PHON 독립 재계산
- 일일 `pg_cron` reconciliation 03:00 KST
- micro-PHON 마이그레이션 (integer → 1e6) + `compute_payout_micro_phon` SQL
- 월간 시드 공개 + 외부 검증 API (`/audit/{yyyy-mm}.json`)

---

## 4. Feature Flags (kill switch 시스템)

```
game_authority.pf_session_v1_enabled     ← GA-A kill switch
game_authority.crash_server_settle
game_authority.dice_server_settle
game_authority.limbo_server_settle
game_authority.wheel_server_settle
game_authority.plinko_hmac
game_authority.mines_v2_cashout
game_authority.auto_bet_server
game_authority.reconciliation_strict
game_authority.kill_switch               ← 신규 베팅 전체 차단
game_authority.read_only_resume          ← active 라운드 resume만 허용
```

### 4.1 PF 세션 장애 시 Graceful Degrade (결정: 선택 B — 보안 절대 우선)

| Level | Flag 상태 | 동작 |
|---|---|---|
| **L0 정상** | `pf_session_v1_enabled=true`, `kill_switch=false` | pf_sessions + Edge HMAC, rotate 가능 |
| **L1 (폐기)** | — | **사용하지 않음**. PF 인프라 다운 = 즉시 L2로 점프 |
| **L2 Read-only Resume** | `kill_switch=true`, `read_only_resume=true` | 신규 베팅 차단. active 라운드 resume + settle만 허용. auto-bet worker pause. **사용자 자금 안전.** |
| **L3 전체 정지** | `kill_switch=true`, `read_only_resume=false` | 모든 게임 동작 중단. 출금만 가능 (관리자 unfreeze 후) |

**판단 근거**:
- 한국 코인 커뮤니티는 보안 이슈를 6시간 안에 퍼뜨림 → 회복 불가능한 평판 손실
- 출시 전 = 운영 경험 0 → L1 같은 "임시 보안 약화" 모드를 운영 실수로 장기 방치할 위험
- L2 (read-only resume)이 사용자 자금 안전 + 보안 동시 만족

**L2 자동 발동 조건** (pg_cron 매 1분 체크):
- pf_session_create_or_get_v1 RPC 에러율 > 5% (최근 5분)
- 또는 관리자 수동 토글

**L2/L3 진입/이탈 audit**:

```sql
CREATE TABLE IF NOT EXISTS pf_degrade_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,                       -- 'L2_enter','L2_exit','L3_enter','L3_exit'
  reason text NOT NULL,
  triggered_by text NOT NULL,                -- 'auto_health_check','manual_admin'
  affected_user_count int,
  active_round_count int,
  created_at timestamptz DEFAULT now()
);

-- L2/L3 자동 timeout (4h 후 관리자 미개입이면 알람 escalate)
-- 단, 자동 L0 복귀는 금지 (반드시 관리자 수동 검증 후)
```

**진입 시 자동 발동**:
- Slack/이메일 알람 (관리자 그룹)
- 출금 freeze (L3만, L2는 출금 정상)
- 사용자에게 상태 배너 표시: "시스템 점검 중 — 신규 베팅 일시 중단. active 게임은 정상 정산."

---

## 5. Resume + Timeout 정책 (게임별)

### 5.1 Crash (가장 복잡)

베팅 후 새로고침 시 서버가 `started_at + crash_point_e6 + auto_cashout_e6`로 현재 multiplier 재계산:

```
elapsed_ms = now - round.started_at
current_mult_e6 = expCurve(elapsed_ms)   // 클라와 동일 곡선 SSOT
```

| 조건 | 정산 | UX |
|---|---|---|
| `current_mult ≥ crash_point` | 손실 (payout=0) | "이미 종료된 라운드" 카드 + crash_point reveal |
| `auto_cashout` 있고 `auto_cashout < crash_point` 이고 `current_mult ≥ auto_cashout` | 승리 @ auto_cashout | 결과 카드 + 애니 스킵 가능 |
| `auto_cashout` 없고 `current_mult < crash_point` | 진행 중 | 현재 multiplier에서 애니 재개, 수동 cashout 가능 |
| betting phase (아직 running 전) | 대기 유지 | betting UI 복원, re-debit 0 |

**Crash 라운드 max lifetime = 60분** (무한 active 차단):

```typescript
// supabase/functions/_shared/crashTimeout.ts
export const CRASH_ROUND_MAX_LIFETIME_MS = 60 * 60 * 1000;

// crash-force-settle-cron (pg_cron 5분마다)
// 60분+ 경과 active 라운드 → 강제 settle
// auto_cashout 있고 auto_cashout < crash_point → 정상 정산
// 그 외 → 손실 처리
// FOR UPDATE SKIP LOCKED + idempotency로 동시성 안전
```

운영 첫 달 측정 데이터 기반 60분 → 적정값 조정 (15~120분 범위 검토).

### 5.2 Dice / Limbo / Wheel (즉시 결정)

| 시점 | 정책 |
|---|---|
| place 직후 이탈 | 서버에 outcome 이미 확정. 복귀 시 round_status 조회 → 결과 표시만 (re-settle idempotent) |
| rolling 애니 중 이탈 | 복귀 시 애니 재생 또는 스킵-to-result (유저 설정) |
| 정산 완료 후 | idle. 추가 동작 없음 |

### 5.3 Mines (멀티스텝)

| 시점 | 정책 |
|---|---|
| 이탈 | `game_active_sessions` + secrets 유지 |
| 복귀 | revealed tiles 복원, 계속 reveal/cashout |
| 지뢰 hit 후 이탈 | 이미 settled. 결과만 표시 |

### 5.4 Plinko (큐)

시나리오: 5개 enqueue, 4개 land, 1개 pending, unmount

| 항목 | 정책 |
|---|---|
| 4개 landed | 이미 credit 완료 (idempotent). 히스토리만 표시 |
| 1개 pending | 복귀 시 서버 `plinko_queue`에서 path 조회 → 애니 재생 → land callback → settle |
| 5분+ pending (stale) | 서버 auto-settle (refund X). path대로 payout |
| unmount | refund 호출 금지 |

### 5.5 Auto-bet active 중 Stop

| 시점 | 정책 |
|---|---|
| Stop 클릭 + in-flight round 없음 | 즉시 `status=stopped` |
| Stop 클릭 + round 진행 중 | `status=stopping` → 현재 라운드 완료 후 stopped (Stake 동형) |
| Stop 전 이탈 | 서버 worker 계속 (의도). 복귀 시 UI에서 stop 가능 |
| stopping 중 새 라운드 | worker가 enqueue 안 함 (DB status gate) |

---

## 6. 보안 명세

### 6.1 Edge Function 시그니처 (`mode` 클라 입력 금지)

```typescript
// supabase/functions/_shared/modeResolver.ts
export type GameMode = 'demo' | 'real';

export async function resolveMode(userId: string): Promise<GameMode> {
  const user = await fetchUser(userId);
  
  // 규칙 1: anon user는 무조건 demo
  if (user.auth_type === 'anonymous') return 'demo';
  
  // 규칙 2: user_settings.preferred_mode 따름 (DB persisted)
  const settings = await fetchUserSettings(userId);
  if (settings.preferred_mode === 'demo') return 'demo';
  
  // 규칙 3: real (잔액 부족 시 silent fallback 금지, insufficient_funds 명시 에러)
  return 'real';
}
```

**모든 game place EdgeFn**:
```typescript
// BEFORE (위험): { mode, bet_phon, ... }
// AFTER (안전): { bet_phon, bet_params, idempotency_key }
//   서버가 resolveMode()로 mode 결정. 응답에 mode 포함하여 클라 UI에 표시.
```

### 6.2 `user_settings` 테이블 (GA-A에서 추가)

```sql
CREATE TABLE IF NOT EXISTS user_settings (
  user_id uuid PRIMARY KEY,
  preferred_mode text DEFAULT 'real' CHECK (preferred_mode IN ('demo','real')),
  safety_tier text NOT NULL DEFAULT 'tier_0_new',
  region text NOT NULL DEFAULT 'region_global',
  daily_loss_limit_phon bigint,              -- NULL = 무제한 (opt-in only)
  daily_loss_limit_pct int,                  -- NULL = 무제한; opt-in 시 1~99
  max_consecutive_losses int,                -- NULL = 무제한; opt-in 시 1~100
  daily_round_limit int DEFAULT 10000,
  auto_bet_consent_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION user_set_preferred_mode_v1(
  p_user_id uuid, p_mode text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF p_mode NOT IN ('demo','real') THEN RAISE EXCEPTION 'invalid mode'; END IF;
  IF EXISTS (SELECT 1 FROM game_active_sessions WHERE user_id = p_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'cannot switch mode while game session active';
  END IF;
  INSERT INTO user_settings (user_id, preferred_mode) VALUES (p_user_id, p_mode)
  ON CONFLICT (user_id) DO UPDATE SET preferred_mode = EXCLUDED.preferred_mode, updated_at = now();
END; $$;
```

### 6.3 모든 financial RPC 공통 규칙
- `pg_advisory_xact_lock(hashtext(user_id::text)::bigint)`
- `idempotency_key` 입력 + `money_idempotency_ledger` dedup
- `SECURITY DEFINER` + 명시적 권한 체크

### 6.4 데모 PF 처리

- 데모 = `pf_sessions` 동일 사용 (anon auth로 user_id 확보)
- 별도 `demo_pf_sessions` **없음** — 스키마 분기 X
- 클라 PRNG **금지** — demo도 Edge Function이 outcome 결정
- `game_rounds.bet_mode`: `'demo' | 'real'` (감사/통계용)
- PF 모달 표시: "데모 · RTP 99% · 검증 가능" + server_seed_hash + nonce (리얼과 동일)

**마케팅 효과**: 데모에서도 `/provably-fair` 검증 가능 → 한국 코인 커뮤니티 신뢰 시그널.

---

## 7. 부하 테스트 기준 (한국 시장 중간 시나리오)

**가정** (PHONARA 한국 시장 진입, 보수와 viral 사이 중간값):

```yaml
business_targets:
  dau_6_months: 10,000
  dau_1_year: 50,000
  auto_bet_user_ratio: 0.15      # 한국 유저 자동화 친화도 반영
  peak_concurrent_ratio: 0.60    # 저녁 9~12시 집중
```

**산출**:

| 시점 | DAU | 동시 active auto-bet | 5x 부하 기준 |
|---|---|---|---|
| 6개월 | 10,000 | 10,000 × 0.15 × 0.60 = **900** | **4,500** (GA-J launch gate) |
| 1년 | 50,000 | 50,000 × 0.15 × 0.60 = **4,500** | **22,500** (GA-K hardening gate) |

**Acceptance**:
- **GA-J launch gate**: 4,500 active sessions, worker 5초 이내 1 tick 처리, 0 duplicate settle
- **GA-K hardening**: 22,500 active sessions, p95 tick latency < 2s
- 실측이 6개월 시점에 1,800 (가정 ÷ 5) 초과하면 즉시 hardening 트랙 발동

---

## 8. 성능 목표

| 메트릭 | 목표 | 조건 |
|---|---|---|
| warm path p95 | < 150ms | keep-alive 연속 100회 |
| cold start 포함 p95 | < 250ms | 5분 idle 후 호출 |
| cold start p99 | < 400ms | — |
| GA-E 완료 시 | 실측 리포트 | 미달 시 cron warm-up 또는 DB RPC fallback 검토 |

GA-E completion report에 실측 표 필수. 목표 미달해도 기능 출시 가능, 단 report에 잔여 리스크 기록.

---

## 9. 일정 (1인 + AI, 100% 직렬)

| 주차 | PR | 영업일 | 누적 |
|---|---|---|---|
| W1 | GA-0 (0.5d) → GA-B (0.5d) → GA-C (0.25d) → GA-D (0.5d) → Hotfix (0.25d) → GA-A (2.5d) | 4.5d | 4.5d |
| W2~W3 | GA-E Crash | 7d | 11.5d |
| W4 | GA-F Dice | 3d | 14.5d |
| W4~W5 | GA-G Limbo | 3d | 17.5d |
| W5 | GA-H Wheel | 3d | 20.5d |
| W5~W6 | GA-I Plinko | 4d | 24.5d |
| W7~W8 | GA-J (J-1/2/3) | 8d | 32.5d |
| W8~W9 | GA-K | 4d | 36.5d |

**총 36~37 영업일 ≈ 7~9주 (1인 + AI)**

### GA-E 분 단위 견적

| 작업 | 추정 (분) |
|---|---|
| (a) crash-place Edge Function | 240~360 |
| (b) crash-cashout Edge Function | 180~240 |
| (c) DB migration (game_rounds 확장) | 90~120 |
| (d) `_shared/pf.ts` + `_shared/money.ts` | 60~90 |
| (e) 클라 CrashScreen refactor | 240~360 |
| (f) 단위 테스트 | 180~240 |
| (g) 통합 테스트 | 240~300 |
| (h) feature_flag + 배포 | 60~90 |
| (i) A/B 관찰 (백그라운드) | 300+ |
| 버퍼 (디버그/회귀) | 480~960 |
| **합계 (액티브)** | **33~45시간** = 6~8 영업일 |

---

## 10. Mandatory PR 규칙

1. 단일 PR 단일 책임 (GA-X 범위 외 수정 금지)
2. 마이그레이션 forward-only + idempotent (`IF NOT EXISTS`)
3. financial RPC: advisory lock + idempotency + SECURITY DEFINER
4. 클라는 결과 계산 금지 — `TODO(real-money)` 0건이 완료 gate
5. PR당 4산출물: SQL + Edge/RPC + 클라 + 테스트
6. `docs/PHONARA-GAME-AUTHORITY-COMPLETION-REPORT.md` 섹션 필수
7. 성능: warm p95 < 150ms, cold 포함 p95 < 250ms (GA-E 실측 후 확정)
8. 우연히 발견한 버그는 별도 PR 후보로 보고서 끝에 기록 (현 PR 범위 확장 금지)

---

## 11. 최종 Acceptance Gate (production-ready)

1. 6게임 클라 outcome 계산 grep 0건 (real+demo 모두 Edge 경유)
2. `TODO(real-money)` grep 0건
3. RTP 시뮬 1M 라운드/게임 → 99.0% ± 0.3%
4. tampering 100시나리오 전부 reject
5. PF 외부 검증 1000라운드 100% 일치
6a. **Launch readiness**: auto-bet **4,500** active sessions — worker 5초 이내 1 tick, 0 duplicate settle (GA-ACCEPT-D-1, **launch 전 필수**)
6b. **Full hardening readiness**: auto-bet **22,500** active sessions — p95 tick < 2s (GA-ACCEPT-D-2, **launch 후 90~120일 내 필수**, owner: 쩡팀장)
7. reconciliation 7일 연속 0 alert
8. 이탈/새로고침 refund 악용 + Crash refresh abuse + Crash 60분 timeout + Plinko 큐 abuse 전부 fail (악용 차단됨)
9. 게임별 resume 시나리오 E2E (Crash auto_cashout, Plinko 4/5 pending, auto-bet stopping)
10. L2 read-only resume degrade 동작 확인 (kill_switch 토글 시 신규 베팅 차단 + active 정산 가능)
11. `mode` 클라 입력 무시 확인 (Edge function `input.mode` 참조 0건 grep)
12. completion report 11개 PR 섹션 + GA-E 실측 latency 표

---

## 12. 실행 순서 (Cursor 작업 지시)

```
1. 본 문서를 docs/PHONARA-GAME-AUTHORITY-PLAN-v3-FINAL.md로 저장 (SSOT).
2. docs/PHONARA-GAME-AUTHORITY-COMPLETION-REPORT.md 빈 템플릿 생성 (11개 PR 섹션).
3. W1 직렬 진행: GA-0 → GA-B → GA-C → GA-D → Hotfix → GA-A
   - 각 PR 완료 시: commit + report 섹션 작성 + 사용자 확인 받기
4. GA-A 완료 후 사용자 확인 → GA-E 시작 (6~8일, 템플릿 검토 필수)
5. GA-E 승인 후 GA-F → GA-G → GA-H → GA-I (직렬)
6. GA-J (J-1/2/3 분할) → GA-K
7. 확인 없이 PR 범위 늘리지 말 것. 우연히 발견한 버그는 별도 PR 후보로 보고서 끝에 기록.
```

---

## 13. 책임 도박 안전장치 (한국 시장 + 신규 운영자 보호)

Region-Aware 3 profiles (`safety_tier` × `region`) + **opt-in** loss limits (ADR §2026-06-08):

| 항목 | Default | 사용자 조정 |
|---|---|---|
| 일일 손실 한도 | **없음 (NULL)** | opt-in: PHON 절대값 또는 bankroll 1~99% |
| 일일 라운드 한도 | 10,000 rounds | 1~50,000 |
| 연속 손실 한도 | **없음 (NULL)** | opt-in: 1~100 (무제한 금지) |
| tick interval 최소 | 1000ms | 변경 불가 |
| 동시 active 세션 | 3개 | 변경 불가 |
| "자동 베팅 동의" 체크박스 | 매 세션 강제 | 변경 불가 |

**Region-Aware profiles** (GA-J enforce):
- `tier_0_new` + `region_kr`: UI에서 limit **권장** (silent enforce 금지)
- `tier_1_regular` / `tier_2_vip`: 동일 — opt-in 전까지 cap 없음

**자동 정지 이벤트 후** (opt-in 한도 도달 시):
- 24시간 cool-down (같은 전략 즉시 재시작 금지)
- push + 인앱 알림: 정지 사유, 누적 손익, 다음 시작 가능 시간

**왜 이게 차별화 무기인가**:
- Stake/Rollbit는 책임 도박 안전장치 약함 (한국 규제 시각에서 취약점)
- 해외 entity 구조 + 강력한 default 안전장치 = 한국 사용자 자기보호 + 운영자 법적 안전성 동시 확보
- 마케팅 메시지: "PHONARA는 사용자가 통제할 수 있는 카지노"

---

## 14. 수정 전/후 요약

| 항목 | 현재 | 최종 |
|---|---|---|
| 실효 RTP | ~96% | 99% (demo=real 동일) |
| 데모 체험 | 다른 RTP | 리얼과 동형 베팅/정산 |
| Outcome 권위 | 클라 5게임 | 서버 Edge 6게임 |
| PF | 하드코딩 seed | commit/reveal rotate |
| Mines cashout | 클라 payout | 서버 재계산 |
| Plinko | mulberry32 | HMAC + honest UI |
| 이탈 처리 | Dice 고아 위험 | Resume+Settle, refund 거부 |
| Crash 무한 active | 미정의 | 60분 max + 강제 settle |
| Auto-bet | 클라 setInterval | 서버 worker (탭 닫아도 실행) |
| Mode 결정 | 클라 입력 | 서버 결정 (`resolveMode`) |
| PF degrade | L0 / L1 모호 | L0 / L2(read-only resume) / L3 명확 |
| 페이아웃 | float/round 혼재 | SSOT → micro-PHON + reconciliation |
| 책임 도박 | opt-in limits (default cap 없음) | Region-Aware + GA-J enforce |

---

## 15. 출시 후 운영 가이드 (왕초보 보호 — 매일 확인 사항)

GA-K 완료 후 production 출시 시, 매일 확인할 메트릭 (대시보드 자동 생성):

```yaml
daily_checklist:
  - reconciliation_alerts (어제 24h): 0건이어야 함. 1건 이상 → 즉시 출금 freeze
  - auto-bet active sessions: 추세 모니터링 (가정 대비 ÷5 초과 시 hardening)
  - Crash force-settle count (어제 24h): 비정상 spike 감시
  - Edge Function p95/p99 latency: 목표 대비
  - L2/L3 degrade events: 0건이어야 함 (있으면 audit 즉시 검토)
  - withdrawal queue: 정상 처리 시간 (24h 이내)
  - 사용자 신고/CS 티켓: refund 시도 패턴 모니터링

weekly_checklist:
  - RTP 실측 (게임별, 100k 라운드 sliding window): 99.0% ± 0.3%
  - auto-bet opt-in 손실 한도 도달 사용자 비율: 비정상 spike = UX/마케팅 검토
  - PF 시드 회전 분포: 자동 vs 수동 비율

monthly_checklist:
  - 시드 공개 데이터셋 발행 (/audit/{yyyy-mm}.json)
  - 외부 검증자 결과 (있다면)
  - 1000 PHON 이상 페이아웃 shadow audit 결과
```

이 체크리스트는 운영 첫 3개월간 매일 확인. 자동화 알람 설정 후 점진적으로 weekly로 전환.

---

**END OF v3 FINAL DOCUMENT**
