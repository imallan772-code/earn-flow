## 1) 지난 작업 검증 보고 (코드 리뷰 결과)

지난 턴들에서 만든 통합 지갑/데모 전환 퍼널/Plinko 강화 코드를 다시 훑어 봤습니다. 발견된 사항:

**✅ 정상**
- `walletStore.ts` — `INITIAL_DEMO_GRANT=10,000`, 리필 차단, `granted` 플래그, SSR 가드(`typeof window`), localStorage 마이그레이션 OK
- `OutOfDemoModal` 전역 마운트(`__root.tsx`) OK
- `PlinkoBoard`/`DiceScreen`/`CrashScreen` 모두 `wallet.tryDebit`/`credit` 사용 — 로컬 잔액 state 잔재 없음
- RTP 0.97 통일(`ModeContext`), `gameRules.ts` 카피 정합
- Provably Fair seed 노출 유지(편향 제거)

**⚠️ 점검 필요 / 미세 이슈**
- 라우트 `head` 설명 문구가 아직 "99% RTP"로 남아 있음 (`games.crash.tsx`, `games.dice.tsx`) — 실제 코드는 97%. 메타만 불일치 → 97%로 정정.
- `persistedGameState.ts` v2 마이그레이션은 잔액만 제거, 자동베팅/세팅은 보존 — 의도대로 동작.
- `houseEdge.spec.ts` 기대치가 0.97 기준인지 마지막으로 확인(테스트 한 번 돌려서 그린 확인).

이번 턴(빌드 모드 전환 후) **읽기 검증만** 추가로 수행해서 위 두 항목을 정정합니다. 게임 로직은 손대지 않습니다.

## 2) 랜딩 숫자 자연스러운 "라이브 변동" 처리

요구: 화면의 모든 숫자가 1,000만 명이 실시간으로 쓰는 것처럼 천천히 ↑↓ 움직여야 함.

대상 숫자(`Landing.tsx` + 보조 컴포넌트):
1. 상단 칩 **온라인 접속자** `10,048,987` — 이미 `RollingCountUp`로 ↑만 됨 → ↑/↓ 양방향 미세 변동으로 교체
2. 히어로 통계 카드 3개 (`MOCK_LANDING_HERO_STATS`):
   - "전 세계 실시간 접속 1,012만+" → 1,011만~1,013만 사이 천천히 변동
   - "오늘 지급된 PHON 12억+" → 11.8억~12.4억 사이 변동(증가 우세)
   - "이벤트 보너스 +300%" → **+150% 고정**(요청대로)
3. 본문 "한국 1,012만+ 명" / "1,800 PHON" — 텍스트 안의 카운트는 정적(문장 가독성). 단, "1,012만+"는 칩과 동기화되게 동일 소스에서 끌어옴.
4. `LiveCashoutStrip` "32만 명 접속 중" → 31.8만~32.6만 천천히 변동
5. `FomoMarquee` 안의 "32만 명", "1,012만+", "300%" 문구 → 동적 카운트로 치환하고 300%는 150%로 수정.

### 변동 방식 (`LiveNumber` 신규 컴포넌트)
- 공통 훅: 기준값 `base`, 진폭 `amplitude`(±%), 주기 `intervalMs`(2.5~5초 랜덤), 변화량은 가우시안 jitter로 한 번에 0.02~0.15% 정도만.
- 절대 base의 ±2% 밴드를 넘지 않음(시각적으로 "튀지 않게").
- 트렌드 바이어스: 접속자/지급액은 +60% 확률로 상승, 동접은 50/50.
- `prefers-reduced-motion`이면 base 고정.
- 보간은 기존 `CountUp` 재사용(900ms easeOutCubic) → 부드럽게 흐름.

### 보너스 150% 변경
- `MOCK_EVENT_BONUS_PERCENT = 150`
- 히어로 라벨 `+150%`, 상단 카피 "🔥 오늘만 150% 보너스 이벤트"
- 마퀴 항목 "300% 보너스" → "150% 보너스"
- 라우트 메타(landing/index) "300%" 언급 정정

## 3) 변경 파일

- `src/mocks/fomo.ts` — 300→150, hero stats를 `{ base, amplitude, bias, format }` 형태로 확장
- `src/shared/motion/LiveNumber.tsx` *(신규)* — 양방향 jitter 카운터 (CountUp 재사용)
- `src/shared/motion/RollingCountUp.tsx` — ↓ 변동 허용하도록 옵션 추가(또는 LiveNumber로 교체)
- `src/features/landing/Landing.tsx` — 히어로 카드/카피에 LiveNumber 적용, 150% 반영
- `src/shared/layout/LiveCashoutStrip.tsx` — "32만 명" 라이브화
- `src/shared/layout/OnlineCounterChip.tsx` — base를 fomo SSOT에서 가져오고 LiveNumber로
- `src/shared/motion/FomoMarquee.tsx` 또는 `mocks/fomo.ts` 마퀴 텍스트 — 300→150
- `src/routes/index.tsx`, `src/routes/__root.tsx` — meta description 300→150
- `src/routes/_app/games.crash.tsx`, `games.dice.tsx` — "99% RTP" → "97% RTP" 메타 정정

## 4) 비고

- 모든 변동은 시각 효과만, 비즈니스 로직/지갑/게임엔진에는 손대지 않음.
- 성능: setInterval 1개 컴포넌트당 1개, 컴포넌트 언마운트 시 cleanup, 탭 비활성(`document.hidden`) 시 일시정지.
- 접근성: `aria-live="off"`(스크린리더 폭격 방지), reduced-motion 존중.
