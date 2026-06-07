/**
 * Server-side mode resolution — mirrors supabase/functions/_shared/modeResolver.ts
 * and resolve_user_mode_v1() in Postgres.
 */
import type { User } from "@supabase/supabase-js";
import type { UserSettings } from "@/lib/api/userSettingsSchemas";

export type GameMode = "demo" | "real";

type ModeUser = Pick<User, "is_anonymous"> | null | undefined;

export function isAnonymousUser(user: ModeUser): boolean {
  if (!user) return true;
  return user.is_anonymous === true;
}

/**
 * Pure resolver for tests and client-side display hints.
 * Financial paths must use resolve_user_mode_v1() RPC (server SSOT).
 */
export function resolveModeFromSettings(
  user: ModeUser,
  settings: Pick<UserSettings, "preferred_mode"> | null,
): GameMode {
  if (isAnonymousUser(user)) return "demo";
  if (settings?.preferred_mode === "demo") return "demo";
  return "real";
}
