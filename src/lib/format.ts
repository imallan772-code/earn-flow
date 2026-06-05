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
