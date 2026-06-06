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
  "auth.passwordSameAsOld": "🔄 Pick a password different from your old one!",
  "auth.passwordChanged": "🔐 Password updated! You're good to go",
  "auth.googleNotConfigured": "🚧 Google sign-in isn't ready yet — please try again soon",
  "auth.oauthStateExpired": "🔁 Login link expired — please try Google sign-in again",
  "auth.oauthPkceMissing": "🔁 Start sign-in again from /login (same tab, localhost:8080)",

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

  // Auto-bet strategies
  "strategy.Flat": "Flat (constant)",
  "strategy.Martingale": "Martingale (×2 on loss)",
  "strategy.AntiMartingale": "Anti-Martingale (×2 on win)",
  "strategy.Fibonacci": "Fibonacci",
  "strategy.DAlembert": "D'Alembert (±1 unit)",

  // Mode (Demo/Real)
  "mode.demo": "Demo Mode",
  "mode.real": "Real Mode",
  "mode.switchedToDemo": "🎮 Demo mode active — practice freely",
  "mode.switchedToReal": "Real mode active. Bet responsibly.",

  // Live bets
  "live.title": "Global Live Bets",
  "live.online": "{count} online",
  "live.totalVolume": "Volume {amount} USDT",
};
