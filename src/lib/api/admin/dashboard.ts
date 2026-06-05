import { getSupabaseClient } from "@/integrations/supabase/client";
import { adminDashboardStatsSchema } from "@/lib/api/admin/schemas";

export async function adminDashboardStats() {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("admin_dashboard_stats");
  if (error) throw error;
  return adminDashboardStatsSchema.parse(data);
}
