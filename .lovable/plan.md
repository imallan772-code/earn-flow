# Earn 서브탭 + 토스트 톤 분리 + 하단탭 한글화

## 1. Earn 내부 서브탭 (2개)

```
[ 🎯 미션  무료 돈벌기 │ 🎮 게임  돈 더벌기 ]
```

- **미션 탭 (default)**: 출석 스트릭 + 미션 리스트 + 미스터리 박스 (보너스성이라 미션에 흡수)
- **게임 탭**: 8게임 GameLobby 그리드

라벨은 2단(굵은 글자 + 보조 문구). 상단 헤더/온라인 카운터는 고정, 콘텐츠만 교체.

### 파일
- 신규 `src/shared/ui/SegmentedTabs.tsx` — 디자인 토큰만, holographic active indicator
- 수정 `src/features/earn/EarnScreen.tsx` — `useState<"missions"|"games">` + 섹션 분기 (코드 이동만)

---

## 2. 토스트 톤 분리 + i18n-ready 구조

### 톤 정책 (핵심)

| 영역 | 톤 | 이모지 | 예시 |
|------|----|----|------|
| **트레이딩** | 진중·금융 단정 | ❌ 없음 | `BTCUSDT 매수 0.0125 체결 @ 67,820.50` / `주문 거절: 잔고 부족` |
| **게임 (베팅/결과)** | 진중·간결 | ❌ 없음 (또는 ▲▼ 같은 중립 기호만) | `2.45배 익절 · +245,000 PHON` / `라운드 종료 · -50,000 PHON` / `베팅 접수 · 50,000 PHON` |
| **미션·보상·복사·온보딩 등 그 외** | 한글 친화 귀여운 톤 | ✅ 적극 사용 | `🎉 가입 완료! 첫 보상 받으러 가요` / `📋 복사 완료!` / `🎁 미스터리 박스 오픈!` |

**금지 사항**: 돈을 잃는 토스트(게임 패배/주문 거절/출금 실패 등)에 절대 귀여운 말투/이모지 사용 금지. 짧고 사실 기반으로만.

### 신규 파일 구조

```
src/shared/i18n/
├── locale.ts        # "ko" | "en", localStorage 영속
├── messages.ko.ts   # 한국어 카탈로그 (default)
├── messages.en.ts   # 영어 카탈로그 (스켈레톤)
├── types.ts         # MessageKey 유니온
└── index.ts         # t(key, params?) 함수

src/shared/ui/toast.ts  # 도메인별 토스트 헬퍼
```

### 카탈로그 예시 (`messages.ko.ts`)

```ts
// === 트레이딩 (진중) ===
"trade.filled":   "{side} {sym} {qty} 체결 @ {price}",
"trade.partial":  "{side} {sym} {filled}/{qty} 부분 체결",
"trade.canceled": "주문 취소됨",
"trade.rejected": "주문 거절: {reason}",
"order.placed":   "{side} 주문 접수 · {qty} @ {price}",

// === 게임 (진중·간결) ===
"game.bet":       "베팅 접수 · {amount} PHON",
"game.cashout":   "{mult}배 익절 · +{amount} PHON",
"game.bust":      "라운드 종료 · -{amount} PHON",
"game.win":       "정산 · +{amount} PHON",
"game.lose":      "정산 · -{amount} PHON",

// === 그 외 (귀여운 톤, 이모지 OK) ===
"auth.signupDone":     "🎉 가입 완료! 첫 보상 받으러 가요",
"auth.welcomeBack":    "👋 다시 오셨네요!",
"mission.claimed":     "✨ +{amount} PHON 받았어요!",
"box.opened":          "🎁 미스터리 박스 오픈! +{amount} PHON",
"referral.copied":     "📋 추천코드 복사 완료! 친구에게 보내세요",
"ui.copied":           "📋 복사되었습니다",
"ui.comingSoon":       "🚧 곧 출시됩니다",
"deposit.giftPending": "🎁 상품권 확인 중이에요",
"transfer.done":       "✅ 전환 완료",

// === 손실/실패 (귀엽지 않게) ===
"withdrawal.submitted": "출금 신청이 접수되었습니다",
"withdrawal.failed":    "출금 실패: {reason}",
"deposit.failed":       "입금 처리 실패: {reason}",
```

### 헬퍼 API (`shared/ui/toast.ts`)

```ts
export const appToast = {
  // 트레이딩 — sonner 기본 스타일, 이모지/아이콘 없음
  trade: {
    filled:   (p) => sonner(t("trade.filled", p),   { duration: 2500 }),
    rejected: (p) => sonner.error(t("trade.rejected", p)),
    canceled: ()  => sonner(t("trade.canceled")),
  },
  // 게임 — 익절은 success(녹), 손실은 기본(중립). 이모지 없음.
  game: {
    bet:     (p) => sonner(t("game.bet", p),     { duration: 1500 }),
    cashout: (p) => sonner.success(t("game.cashout", p)),
    bust:    (p) => sonner(t("game.bust", p)),          // ❌ error 톤 회피 — 사실 통보
    win:     (p) => sonner.success(t("game.win", p)),
    lose:    (p) => sonner(t("game.lose", p)),
  },
  // 그 외 — 귀여운 톤, 이모지는 카탈로그에 이미 포함
  ui: {
    copied:    () => sonner.success(t("ui.copied")),
    comingSoon:() => sonner(t("ui.comingSoon")),
  },
  mission: { claimed: (p) => sonner.success(t("mission.claimed", p)) },
  box:     { opened:  (p) => sonner.success(t("box.opened", p)) },
  auth:    { signupDone: () => sonner.success(t("auth.signupDone")), welcomeBack: () => sonner(t("auth.welcomeBack")) },
  
  // 손실/실패는 별도 — 귀엽지 않게
  withdrawal: {
    submitted: () => sonner(t("withdrawal.submitted")),
    failed:    (p) => sonner.error(t("withdrawal.failed", p)),
  },
};
```

### 글로벌 확장 포인트
- `{placeholder}` 보간 → 어순 다른 언어 자연 대응
- 로케일 추가 = 카탈로그 파일 1개 + `locale.ts` 유니온 1줄. 컴포넌트 변경 0
- `MessageKey` 유니온으로 오타 컴파일 에러
- 게임/트레이딩은 영어로 가도 톤이 유지되도록 영어 카탈로그도 동일 정책 (`"game.cashout": "Cashout {mult}x · +{amount} PHON"` 처럼 군더더기 없음)

### 마이그레이션 대상 (기존 7곳)
- `WithdrawalForm` → `appToast.withdrawal.submitted()`
- `ProfileScreen` 추천코드 → `appToast.ui.copied()` 또는 `referral.copied`
- `TransferBridge` → `appToast.ui.copied()` 계열 (`transfer.done`)
- `DepositGift` → `deposit.giftPending` (귀여운 톤 유지)
- `DepositCrypto` 주소복사 → `appToast.ui.copied()`
- `AuthShell` → `appToast.auth.signupDone()` / `welcomeBack()`
- `Onboarding` 복사 → `appToast.ui.copied()`

게임 화면(Crash, Dice)의 cashout/bust도 `appToast.game.cashout()` / `bust()`로 통일 — 현재 자유 문자열 제거.

---

## 3. 하단 5탭 한글 최적화

| # | 영문(현재) | 한글(변경) | 라우트 |
|---|----------|-----------|-------|
| 1 | Pulse | **피드** | `/feed` |
| 2 | Earn | **돈벌기** | `/earn` |
| 3 | Trade | **트레이드** | `/exchange/BTCUSDT` |
| 4 | Notice | **알림** | `/notice` |
| 5 | My | **마이** | `/my` |

- "돈벌기"가 가장 길지만 3자 → 390px 5등분(약 70px/슬롯)에서 `text-xs`로 한 줄 안전
- 라벨은 `t("nav.feed")` 등 i18n 키 경유 → 추후 영문 fallback 즉시 가능
- 아이콘 그대로 (Zap/Gamepad2/TrendingUp/Bell/User)

---

## 변경 범위
- 신규 7개: `SegmentedTabs.tsx`, `shared/i18n/` 5개, `shared/ui/toast.ts`
- 수정: `EarnScreen.tsx`, `BottomNav.tsx`, 기존 토스트 호출 7곳 + 게임 화면 토스트
- **삭제 없음, 중복 없음**

## 검증
- `tsc` clean / 33개 vitest GREEN
- 390×844에서 Earn 첫 진입 시 미션 탭 above-the-fold, 게임 탭 클릭 시 그리드 스크롤 없이 노출
- 하단 5탭 한 줄 정렬 확인
- 토스트 샘플 발사: 게임 익절(이모지 없음, 진중) vs 미션 보상(이모지 ✨ 포함) 톤 차이 검증
- 손실 토스트(`game.bust`, `withdrawal.failed`)에 이모지/귀여운 단어 0건 확인

승인하시면 위 순서대로 구현 후 라운드 D(Slots)로 진행합니다.
