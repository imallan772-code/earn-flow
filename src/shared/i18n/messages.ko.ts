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
  "auth.passwordSameAsOld": "🔄 기존 비밀번호와 달라야 해요! 다른 비밀번호를 입력해 주세요",
  "auth.passwordChanged": "🔐 비밀번호가 변경되었어요! 바로 이용하실 수 있어요",
  "auth.googleNotConfigured": "🚧 구글 로그인 준비 중이에요. 잠시 후 다시 시도해 주세요",
  "auth.oauthStateExpired": "🔁 로그인 연결이 끊겼어요. 구글 탭에서 다시 시도해 주세요",
  "auth.oauthPkceMissing": "🔁 로그인을 처음부터 다시 해 주세요 (같은 탭·localhost:8080)",

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

  // === 자동 베팅 전략 (한글) ===
  "strategy.Flat": "정액 (항상 같은 금액)",
  "strategy.Martingale": "마틴게일 (패배 시 2배)",
  "strategy.AntiMartingale": "역마틴게일 (승리 시 2배)",
  "strategy.Fibonacci": "피보나치 (수열 추격)",
  "strategy.DAlembert": "달랑베르 (1단위 가감)",

  // === 모드 (데모/리얼) ===
  "mode.demo": "데모 모드",
  "mode.real": "리얼 모드",
  "mode.switchedToDemo": "🎮 데모 모드 활성화 — 마음껏 연습하세요",
  "mode.switchedToReal": "리얼 모드 활성화. 신중한 베팅을 권장합니다.",

  // === 라이브 베팅 ===
  "live.title": "글로벌 라이브 베팅",
  "live.online": "{count}명 접속 중",
  "live.totalVolume": "누적 거래액 {amount} USDT",

  // === Provably Fair 독립 검증 (/fair/verify) ===
  "fair.verify.title": "Provably Fair 검증",
  "fair.verify.subtitle":
    "공개된 server seed + client seed + nonce로 라운드 결과를 직접 재현합니다.",
  "fair.verify.home": "홈으로",
  "fair.verify.run": "결과 재현",
  "fair.verify.running": "검증 중…",
  "fair.verify.shareLink": "링크 복사",
  "fair.verify.openFromModal": "독립 검증 페이지에서 열기",
  "fair.verify.field.game": "게임",
  "fair.verify.field.serverSeed": "Server seed (공개)",
  "fair.verify.field.serverSeed.placeholder": "라운드 종료 후 공개된 시드",
  "fair.verify.field.serverSeedHash": "Server seed hash (선택 — 사전 커밋)",
  "fair.verify.field.serverSeedHash.placeholder": "SHA256(serverSeed)",
  "fair.verify.field.clientSeed": "Client seed",
  "fair.verify.field.nonce": "Nonce",
  "fair.verify.field.mineCount": "Mine count",
  "fair.verify.field.risk": "Risk",
  "fair.verify.field.segments": "Segments",
  "fair.verify.game.crash": "Crash",
  "fair.verify.game.dice": "Dice",
  "fair.verify.game.limbo": "Limbo",
  "fair.verify.game.wheel": "Wheel",
  "fair.verify.game.mines": "Mines",
  "fair.verify.game.plinko": "Plinko",
  "fair.verify.field.rows": "행 (rows)",
  "fair.verify.result.legend": "검증 결과",
  "fair.verify.result.commitHash": "SHA256(server seed)",
  "fair.verify.result.commitMatch": "커밋 일치",
  "fair.verify.result.match": "일치 ✓",
  "fair.verify.result.mismatch": "불일치 ✗",
  "fair.verify.result.copyHash": "커밋 해시 복사",
  "fair.verify.error.fallback": "검증 실패",
  "fair.verify.footer.stake": "Stake.com 동일 HMAC-SHA256 스킴 · 라운드 시작 전 커밋 해시 공개",
} as const;
