/**
 * GA-K reconciliation — RPC wrappers.
 */
import { getSupabaseClient } from "@/integrations/supabase/client";
import { z } from "zod";

const probeResultSchema = z.object({
  payout_phon: z.number().int(),
  payout_micro: z.number().int().nullable(),
  payout_micro_exact: z.number().int().nullable(),
});

const auditExportSchema = z.object({
  month: z.string(),
  generated_at: z.string(),
  rotated_seeds: z.array(z.record(z.unknown())),
  reconciliation_24h: z.record(z.unknown()),
});

export async function reconciliationProbe(input: {
  bet: number;
  multiplier: number;
  multiplierE6?: number;
}): Promise<z.infer<typeof probeResultSchema>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("reconciliation_probe_v1", {
    p_bet: input.bet,
    p_multiplier: input.multiplier,
    ...(input.multiplierE6 !== undefined ? { p_multiplier_e6: input.multiplierE6 } : {}),
  });
  if (error) throw error;
  return probeResultSchema.parse(data);
}

export async function auditExportMonth(yyyyMm: string): Promise<z.infer<typeof auditExportSchema>> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("audit_export_month_v1", { p_yyyy_mm: yyyyMm });
  if (error) throw error;
  return auditExportSchema.parse(data);
}
