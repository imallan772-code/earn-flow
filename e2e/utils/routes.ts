/** Public routes — no auth required (SSR may still render shell). */
export const PUBLIC_ROUTES = ["/", "/login", "/signup"] as const;

/** App routes — RequireAuth when Supabase is configured. */
export const APP_ROUTES = [
  "/feed",
  "/earn",
  "/my",
  "/notice",
  "/event",
  "/exchange/BTCUSDT",
] as const;

export const GAME_ROUTES = [
  "/games/mines",
  "/games/dice",
  "/games/crash",
  "/games/limbo",
  "/games/wheel",
  "/games/plinko",
] as const;

export const ADMIN_ROUTES = ["/admin", "/admin/notice", "/admin/event"] as const;

export const MONEY_ROUTES = [
  "/deposit",
  "/deposit/bank",
  "/deposit/crypto",
  "/deposit/gift",
  "/withdrawal",
  "/withdrawal/phon",
  "/withdrawal/crypto",
  "/transfer",
] as const;
