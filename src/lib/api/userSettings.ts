import { getSupabaseClient } from "@/integrations/supabase/client";
import { userSettingsSchema, type UserSettings } from "./userSettingsSchemas";

export function preferredModeErrorMessage(error: { message?: string }): string {
  const msg = error.message ?? "";
  if (msg.includes("ANON_CANNOT_SET_REAL")) {
    return "익명 계정은 리얼 모드를 사용할 수 없습니다. 이메일로 가입·로그인해 주세요.";
  }
  if (msg.includes("ACTIVE_GAME_SESSION")) {
    return "진행 중인 게임이 있어 모드를 변경할 수 없습니다. 해당 게임을 마친 뒤 다시 시도해 주세요.";
  }
  return "모드를 변경할 수 없습니다. 잠시 후 다시 시도해 주세요.";
}

export async function getUserSettings(): Promise<UserSettings> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("user_get_settings_v1");
  if (error) throw error;
  return userSettingsSchema.parse(data);
}

export async function setPreferredMode(mode: "demo" | "real"): Promise<UserSettings> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("user_set_preferred_mode_v1", {
    p_mode: mode,
  });
  if (error) throw error;
  return userSettingsSchema.parse(data);
}

export async function resolveUserMode(): Promise<"demo" | "real"> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("resolve_user_mode_v1");
  if (error) throw error;
  if (data !== "demo" && data !== "real") {
    throw new Error("resolve_user_mode_v1 returned invalid mode");
  }
  return data;
}
