/**
 * Korean message catalog (default).
 *
 * Tone policy:
 * - trade.*, game.*  → 진중·간결. 이모지 금지. 사실 기반.
 * - withdrawal.*, deposit.*.failed → 손실/실패. 귀엽지 않게.
 * - 그 외 (auth, mission, box, referral, ui, transfer) → 귀여운 톤, 이모지 적극.
 */
export const messages_ko = {
  // === 트레이딩 (진중) ===
  "trade.filled": "{side} {sym} {qty} 체결 @ {price}",
  "trade.partial": "{side} {sym} {filled}/{qty} 부분 체결",
  "trade.canceled": "주문 취소됨",
  "trade.rejected": "주문 거절: {reason}",
  "order.placed": "{side} 주문 접수 · {qty} @ {price}",

  // === 게임 (진중·간결) ===
  "game.bet": "베팅 접수 · {amount} PHON",
  "game.cashout": "{mult}배 익절 · +{amount} PHON",
  "game.bust": "라운드 종료 · -{amount} PHON",
  "game.win": "정산 · +{amount} PHON",
  "game.lose": "정산 · -{amount} PHON",

  // === 인증 / 온보딩 (귀여운 톤) ===
  "auth.signupDone": "🎉 가입 완료! 첫 보상 받으러 가요",
  "auth.welcomeBack": "👋 다시 오셨네요!",

  // === 미션 / 박스 / 추천 ===
  "mission.claimed": "✨ +{amount} PHON 받았어요!",
  "box.opened": "🎁 미스터리 박스 오픈! +{amount} PHON",
  "referral.copied": "📋 추천코드 복사 완료! 친구에게 보내세요",

  // === UI 공용 ===
  "ui.copied": "📋 복사되었습니다",
  "ui.comingSoon": "🚧 곧 출시됩니다",

  // === 입금 / 전환 (귀여운 톤) ===
  "deposit.giftPending": "🎁 상품권 확인 중이에요",
  "transfer.done": "✅ 전환 완료",

  // === 손실 / 실패 (귀엽지 않게) ===
  "withdrawal.submitted": "출금 신청이 접수되었습니다",
  "withdrawal.failed": "출금 실패: {reason}",
  "deposit.failed": "입금 처리 실패: {reason}",

  // === 하단 네비게이션 ===
  "nav.feed": "피드",
  "nav.earn": "돈벌기",
  "nav.trade": "트레이드",
  "nav.notice": "알림",
  "nav.my": "마이",

  // === Earn 서브탭 ===
  "earn.tab.missions": "미션",
  "earn.tab.missions.sub": "무료 돈벌기",
  "earn.tab.games": "게임",
  "earn.tab.games.sub": "돈 더벌기",
} as const;
