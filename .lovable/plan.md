# 데모 = 체험판, 리얼 전환 유도 구조

## 컨셉

데모는 "맛보기 크레딧"으로 한정. 다 쓰면 리필 안 되고 → **"리얼로 전환" CTA**가 뜸. Stake/Roobet도 실제론 데모 자체가 약하고 빠르게 실 베팅으로 보내는 구조.

## 핵심 규칙

### 1. 데모 크레딧(체험판) — `DemoCredit`
- **초기 지급: 1회 10,000원** (현재 1000 → 상향, 한 번에 충분히 체험 가능한 양)
- **리필 없음**. 0원 도달 시 베팅 버튼 비활성화.
- **세션 무관 1회성**: localStorage에 `phonara.demo.granted: true` 플래그. 새로고침/재방문해도 재지급 X.
- 잔액은 게임 간 **공유**(Dice/Crash/Plinko 통합 지갑). 현재 게임별 분리된 balance를 통합 데모 지갑으로 마이그레이션.

### 2. 잔액 소진 시 UX — "Out of Demo" 모달
- 트리거: 베팅 시도 시 `balance < amount` 또는 잔액 0.
- 모달 내용:
  - "체험 크레딧을 모두 사용했어요"
  - 지금까지 데모 통계 (총 베팅 N회, 최고 배율 Xx)
  - **Primary CTA: "리얼 모드로 전환하기"** → 모드 토글 + 입금 화면으로
  - Secondary: "데모 리셋" — **숨김 처리**(개발자 콘솔에서만, 일반 사용자 노출 X)

### 3. 리얼 전환 유도 마이크로 카피
- 데모 잔액 ≤ 30% 도달 시 베팅 패널 하단에 작은 배너:
  > "데모 크레딧 30% 남음 · 리얼로 전환 시 첫 입금 보너스 100%"
- 큰 승리(10x↑) 후 토스트:
  > "데모에서 X원 따셨네요! 리얼이었다면 진짜 출금 가능 →"

### 4. 모드 토글 동작 변경
- 현재: 데모 ↔ 리얼 자유 전환.
- 변경: 리얼 → 데모 전환 시 확인 모달("데모는 체험용입니다. 잔액은 한 번만 지급됩니다"). 리얼 모드 잔액은 별도 보존(0으로 시작, 입금 필요).

### 5. 결과 편향 — **전부 제거**
- 이전 플랜의 `outcomeBias.ts` 폐기. Provably Fair 100% 유지.
- 데모/리얼 모두 동일한 RTP **97%** 적용 (현재 demo 100% → 97%로 통일).
- 이유: 데모가 잘 터지면 리얼 전환 후 "왜 안 터져?" 이탈. 동일 RTP라야 데모 체감이 리얼로 그대로 이어짐. Stake 방식.

## 변경 파일

1. `src/shared/mode/ModeContext.tsx`
   - `RTP.demo`: 1.00 → **0.97** (리얼과 동일)
   - `rtpLabel`도 통일.

2. `src/shared/wallet/demoWallet.ts` **(신규)**
   - 통합 데모 지갑 store (현재 게임별 balance 대체).
   - `INITIAL_GRANT = 10_000`, `getBalance()`, `debit(n)`, `credit(n)`, `hasBeenGranted()`, `resetForDev()`.
   - localStorage 키: `phonara.demo.wallet.v1` (`{ balance, granted, totalBets, maxMultiplier }`).
   - 리얼 지갑(`realWallet.ts`)도 같이 신설, 초기 0.

3. `src/shared/games/state/persistedGameState.ts`
   - `DicePersisted` / `CrashPersisted`에서 `balance` 제거. nonce/history/UI 상태만 보존.
   - balance는 항상 현재 모드의 wallet에서 읽음.

4. `src/shared/games/plinko/PlinkoBoard.tsx`, `src/features/games/dice/DiceScreen.tsx`, `src/features/games/crash/CrashScreen.tsx`
   - balance read/write를 `useWallet(mode)` 훅으로 전환.
   - 베팅 시 잔액 부족 → `OutOfDemoModal` 띄움.

5. `src/shared/wallet/OutOfDemoModal.tsx` **(신규)**
   - 데모 통계 + 리얼 전환 CTA.

6. `src/shared/wallet/DemoLowBanner.tsx` **(신규)**
   - 잔액 ≤ 30%일 때 베팅 패널 하단에 표시.

7. `src/shared/mode/ModeToggle.tsx`
   - 리얼 → 데모 전환 시 confirm 모달.
   - 데모 모드일 때 토글 옆에 잔액 표시("데모 ₩7,200 남음").

8. `src/shared/games/rules/gameRules.ts`
   - "데모 vs 리얼" 섹션 문구 갱신:
     - 데모: "1회 체험 크레딧 ₩10,000. 모두 사용 시 추가 지급 없음. RTP 97% (리얼과 동일)."
     - 리얼: "실제 입금/출금. RTP 97%. Provably Fair."

## 추가 결정사항

- **데모 통계 노출**: 모달에서 보여줄 통계는 `totalBets`, `maxMultiplier`, `netResult` 3가지로 한정.
- **첫 입금 보너스 카피**: 실제 보너스 기능은 이번 라운드에서 구현 X. 카피만 노출(전환 유도용 마케팅 문구).
- **데모 리셋 백도어**: URL 쿼리 `?reset_demo=1` 로만 가능. UI에는 노출 안 함.

## 마이그레이션 처리

기존 사용자의 게임별 `balance` 값은 무시(데모 신규 지갑이 1회 지급으로 새로 시작). 깨끗한 컷오버, 호환 코드 없음.

## 확인 필요

- (A) 초기 데모 크레딧 금액: **10,000원** 으로 진행할까요, 아니면 다른 금액(예: 50,000)?
- (B) 데모/리얼 잔액 게임 간 **공유**가 맞나요? (현재는 게임별 분리)

승인 시 (A) 10,000원, (B) 공유 지갑으로 진행합니다.
