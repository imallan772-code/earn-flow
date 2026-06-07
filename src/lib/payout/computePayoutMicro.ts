/**
 * GA-K micro-PHON payout SSOT — mirrors SQL compute_payout_micro_phon / compute_payout_from_e6.
 */
const MICRO = 1_000_000;

export function computePayoutPhon(bet: number, multiplier: number): number {
  if (!Number.isFinite(bet) || bet < 0 || !Number.isFinite(multiplier) || multiplier < 0) return 0;
  return Math.round(bet * multiplier);
}

export function computePayoutMicroPhon(betMicro: number, multiplierE6: number): number {
  if (betMicro < 0 || multiplierE6 < 0) return 0;
  return Math.round((betMicro * multiplierE6) / MICRO);
}

export function computePayoutFromE6(bet: number, multiplierE6: number): number {
  if (bet < 0 || multiplierE6 < 0) return 0;
  return Math.round((bet * multiplierE6) / MICRO);
}

export function phonToMicro(phon: number): number {
  return Math.round(phon * MICRO);
}
