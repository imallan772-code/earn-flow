import { getSupabaseClient } from "@/integrations/supabase/client";
import {
  pfSessionRotateSchema,
  pfSessionSchema,
  type PfSession,
  type PfSessionRotateResult,
} from "./pfSessionSchemas";

export async function pfSessionCreateOrGet(
  game: string,
  clientSeed?: string,
): Promise<PfSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("pf_session_create_or_get_v1", {
    p_game: game,
    ...(clientSeed !== undefined ? { p_client_seed: clientSeed } : {}),
  });
  if (error) throw error;
  return pfSessionSchema.parse(data);
}

export async function pfSessionSetClientSeed(
  game: string,
  clientSeed: string,
): Promise<PfSession> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("pf_session_set_client_seed_v1", {
    p_game: game,
    p_client_seed: clientSeed,
  });
  if (error) throw error;
  return pfSessionSchema.parse(data);
}

export async function pfSessionRotate(game: string): Promise<PfSessionRotateResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("pf_session_rotate_v1", {
    p_game: game,
  });
  if (error) throw error;
  return pfSessionRotateSchema.parse(data);
}
