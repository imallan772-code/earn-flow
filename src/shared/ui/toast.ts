/**
 * appToast — domain-scoped toast helper.
 *
 * Tone policy enforced via separate namespaces:
 * - trade.*, game.*  → sonner default (no emoji, no color flair on losses)
 * - mission/box/auth/ui → success() with friendly catalog strings (emoji in text)
 * - withdrawal/deposit failure → error()
 *
 * All copy lives in src/shared/i18n; never pass raw strings here.
 */
import { toast as sonner } from "sonner";
import { t, type MessageParams } from "@/shared/i18n";

interface AmountParams {
  amount: number | string;
}
interface MultParams {
  mult: number | string;
  amount: number | string;
}
interface TradeFillParams {
  side: string;
  sym: string;
  qty: number | string;
  price: number | string;
}
interface TradePartialParams extends TradeFillParams {
  filled: number | string;
}
interface ReasonParams {
  reason: string;
}

export const appToast = {
  // ----- 트레이딩 (진중, 이모지 금지) -----
  trade: {
    filled: (p: TradeFillParams) =>
      sonner(t("trade.filled", p as unknown as MessageParams), { duration: 2500 }),
    partial: (p: TradePartialParams) =>
      sonner(t("trade.partial", p as unknown as MessageParams), { duration: 2500 }),
    canceled: () => sonner(t("trade.canceled")),
    rejected: (p: ReasonParams) => sonner.error(t("trade.rejected", p as unknown as MessageParams)),
    orderPlaced: (p: TradeFillParams) =>
      sonner(t("order.placed", p as unknown as MessageParams), { duration: 2000 }),
  },

  // ----- 게임 (진중, 이모지 금지) -----
  game: {
    bet: (p: AmountParams) =>
      sonner(t("game.bet", p as unknown as MessageParams), { duration: 1500 }),
    cashout: (p: MultParams) => sonner.success(t("game.cashout", p as unknown as MessageParams)),
    bust: (p: AmountParams) => sonner(t("game.bust", p as unknown as MessageParams)),
    win: (p: AmountParams) => sonner.success(t("game.win", p as unknown as MessageParams)),
    lose: (p: AmountParams) => sonner(t("game.lose", p as unknown as MessageParams)),
  },

  // ----- 공용 UI (귀여운 톤, 이모지는 카탈로그 내 포함) -----
  ui: {
    copied: () => sonner.success(t("ui.copied")),
    comingSoon: () => sonner(t("ui.comingSoon")),
  },

  // ----- 미션 / 박스 / 추천 -----
  mission: {
    claimed: (p: AmountParams) =>
      sonner.success(t("mission.claimed", p as unknown as MessageParams)),
  },
  box: {
    opened: (p: AmountParams) => sonner.success(t("box.opened", p as unknown as MessageParams)),
  },
  referral: {
    copied: () => sonner.success(t("referral.copied")),
  },

  // ----- 인증 -----
  auth: {
    signupDone: () => sonner.success(t("auth.signupDone")),
    welcomeBack: () => sonner(t("auth.welcomeBack")),
  },

  // ----- 전환 (귀여운 톤) -----
  transfer: {
    done: () => sonner.success(t("transfer.done")),
  },

  // ----- 입금 -----
  deposit: {
    giftPending: () => sonner(t("deposit.giftPending")),
    failed: (p: ReasonParams) => sonner.error(t("deposit.failed", p as unknown as MessageParams)),
  },

  // ----- 출금 (손실 톤) -----
  withdrawal: {
    submitted: () => sonner(t("withdrawal.submitted")),
    failed: (p: ReasonParams) =>
      sonner.error(t("withdrawal.failed", p as unknown as MessageParams)),
  },

  // 빠른 fallback — 카탈로그에 없는 일회성 메시지에만
  raw: sonner,
};
