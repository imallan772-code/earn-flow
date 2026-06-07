/**
 * GA-J server auto-bet — RPC wrappers (auto_bet_*_v1).
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { z } from "zod";
import {
  autoBetConfigSchema,
  autoBetListItemSchema,
  autoBetSessionSchema,
  type AutoBetConfigPayload,
  type AutoBetListItem,
  type AutoBetSession,
} from "./autoBetSessionSchemas";

export type ServerAutoBetGame = "dice" | "limbo" | "wheel" | "plinko" | "crash" | "mines";

export async function autoBetGrantConsent(): Promise<{ ok: boolean; consent_at: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("auto_bet_grant_consent_v1");
  if (error) throw error;
  return z.object({ ok: z.boolean(), consent_at: z.string() }).parse(data);
}

export async function autoBetCreate(input: {
  game: ServerAutoBetGame;
  config: AutoBetConfigPayload;
  betParams: Record<string, unknown>;
}): Promise<AutoBetSession> {
  const supabase = getSupabaseClient();
  const config = autoBetConfigSchema.parse(input.config);
  const { data, error } = await supabase.rpc("auto_bet_create_v1", {
    p_game: input.game,
    p_config: config,
    p_bet_params: input.betParams as Json,
  });
  if (error) throw error;
  return autoBetSessionSchema.parse(data);
}

export async function autoBetPause(sessionId: string): Promise<{ id: string; status: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("auto_bet_pause_v1", { p_session_id: sessionId });
  if (error) throw error;
  return z.object({ id: z.string().uuid(), status: z.string() }).parse(data);
}

export async function autoBetResume(sessionId: string): Promise<{ id: string; status: string }> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("auto_bet_resume_v1", { p_session_id: sessionId });
  if (error) throw error;
  return z.object({ id: z.string().uuid(), status: z.string() }).parse(data);
}

export async function autoBetStop(sessionId: string): Promise<{
  id: string;
  status: string;
  stop_reason: string | null;
}> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("auto_bet_stop_v1", { p_session_id: sessionId });
  if (error) throw error;
  const parsed = z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      stop_reason: z.string().nullable().optional(),
    })
    .parse(data);
  return { ...parsed, stop_reason: parsed.stop_reason ?? null };
}

export async function autoBetList(): Promise<AutoBetListItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("auto_bet_list_v1");
  if (error) throw error;
  const parsed = z.object({ items: z.array(autoBetListItemSchema) }).parse(data);
  return parsed.items;
}

export async function autoBetSync(sessionId: string): Promise<AutoBetSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("auto_bet_sync_v1", { p_session_id: sessionId });
  if (error) throw error;
  return autoBetSessionSchema.parse(data);
}

export function isAutoBetConsentRequired(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg = `${(error as { message?: string }).message ?? ""}`;
  return msg.includes("AUTO_BET_CONSENT_REQUIRED");
}
