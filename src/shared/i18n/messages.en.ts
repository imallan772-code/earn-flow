/**
 * English message catalog (skeleton).
 * Keep the same tone policy as Korean — trade/game are terse and emoji-free.
 */
import type { messages_ko } from "./messages.ko";

export const messages_en: Record<keyof typeof messages_ko, string> = {
  // Trading — terse
  "trade.filled": "{side} {sym} {qty} filled @ {price}",
  "trade.partial": "{side} {sym} {filled}/{qty} partially filled",
  "trade.canceled": "Order canceled",
  "trade.rejected": "Order rejected: {reason}",
  "order.placed": "{side} order placed · {qty} @ {price}",

  // Game — terse
  "game.bet": "Bet placed · {amount} PHON",
  "game.cashout": "Cashout {mult}x · +{amount} PHON",
  "game.bust": "Round ended · -{amount} PHON",
  "game.win": "Settled · +{amount} PHON",
  "game.lose": "Settled · -{amount} PHON",

  // Auth (friendly)
  "auth.signupDone": "🎉 Welcome! Claim your first reward",
  "auth.welcomeBack": "👋 Welcome back!",

  // Missions / Box / Referral (friendly)
  "mission.claimed": "✨ +{amount} PHON claimed!",
  "box.opened": "🎁 Mystery Box opened! +{amount} PHON",
  "referral.copied": "📋 Referral code copied — share it!",

  // UI common
  "ui.copied": "📋 Copied",
  "ui.comingSoon": "🚧 Coming soon",

  // Deposit / Transfer
  "deposit.giftPending": "🎁 Verifying gift card…",
  "transfer.done": "✅ Conversion complete",

  // Loss / Failure (not cute)
  "withdrawal.submitted": "Withdrawal request received",
  "withdrawal.failed": "Withdrawal failed: {reason}",
  "deposit.failed": "Deposit failed: {reason}",

  // Bottom nav
  "nav.feed": "Feed",
  "nav.earn": "Earn",
  "nav.trade": "Trade",
  "nav.notice": "Alerts",
  "nav.my": "My",

  // Earn sub-tabs
  "earn.tab.missions": "Missions",
  "earn.tab.missions.sub": "Earn free",
  "earn.tab.games": "Games",
  "earn.tab.games.sub": "Earn more",
};
