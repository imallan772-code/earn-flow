/** Postgres RPC money errors that do not need a user-facing refund toast. */
export function isBenignRefundError(error: unknown): boolean {
  const text =
    error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : String(error);
  return (
    text.includes("MONEY_ROUND_NOT_FOUND") ||
    text.includes("MONEY_ROUND_ALREADY_SETTLED") ||
    text.includes("MONEY_ROUND_REFUNDED")
  );
}
