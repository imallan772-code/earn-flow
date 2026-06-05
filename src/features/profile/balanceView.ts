import type { UserBalanceView } from "./useProfile";

const EMPTY_BALANCE: UserBalanceView = {
  phon: 0,
  usdt: 0,
  krw: 0,
  streakDays: 0,
  nickname: "포나라 유저",
  referralCode: "—",
  vipTier: "Bronze",
  vipProgress: 0,
};

export function resolveBalanceView(
  balance: UserBalanceView | null | undefined,
  opts: { isLoading?: boolean; isConfigured?: boolean },
): { view: UserBalanceView; isLoading: boolean } {
  if (balance) return { view: balance, isLoading: false };
  if (opts.isLoading && opts.isConfigured) {
    return { view: EMPTY_BALANCE, isLoading: true };
  }
  return { view: EMPTY_BALANCE, isLoading: false };
}
