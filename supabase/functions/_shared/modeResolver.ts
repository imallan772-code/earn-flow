/**
 * Server-side mode resolution — Edge Function SSOT.
 * Client input `mode` is never trusted.
 */

export type GameMode = "demo" | "real";

export interface ModeUser {
  id: string;
  is_anonymous?: boolean;
}

export interface UserSettingsRow {
  preferred_mode: GameMode;
}

export function resolveMode(
  user: ModeUser,
  settings: UserSettingsRow | null,
): GameMode {
  if (user.is_anonymous === true) return "demo";
  if (settings?.preferred_mode === "demo") return "demo";
  return "real";
}
