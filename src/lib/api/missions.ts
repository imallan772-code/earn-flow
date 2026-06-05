import { getSupabaseClient } from "@/integrations/supabase/client";
import {
  claimMissionResultSchema,
  userMissionsSchema,
  type ClaimMissionResult,
  type UserMission,
} from "@/lib/missions/schemas";

export async function listUserMissions(): Promise<UserMission[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("list_user_missions");
  if (error) throw error;
  return userMissionsSchema.parse(data ?? []);
}

export async function recordMissionProgress(missionId: string, delta = 1) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("record_mission_progress", {
    p_mission_id: missionId,
    p_delta: delta,
  });
  if (error) throw error;
  return data;
}

export async function claimMissionReward(missionId: string): Promise<ClaimMissionResult> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("claim_mission_reward", {
    p_mission_id: missionId,
  });
  if (error) throw error;
  return claimMissionResultSchema.parse(data);
}
