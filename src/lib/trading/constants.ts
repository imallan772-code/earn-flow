export const SUPPORTED_SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];

export const DEFAULT_ORDER_QTY: Record<SupportedSymbol, number> = {
  BTCUSDT: 0.001,
  ETHUSDT: 0.01,
};
