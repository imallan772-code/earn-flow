const krwFmt = new Intl.NumberFormat("ko-KR");
const phonFmt = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 });
const usdtFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatKRW = (n: number) => `₩${krwFmt.format(Math.round(n))}`;
export const formatPHON = (n: number) => phonFmt.format(Math.round(n));
export const formatUSDT = (n: number) => usdtFmt.format(n);

export function compactKR(n: number): string {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1).replace(/\.0$/, "")}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(1).replace(/\.0$/, "")}만`;
  return krwFmt.format(n);
}

/** Social engagement counts — 1.2K, 12.4K, 1.2M */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
