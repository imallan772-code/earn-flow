import { getE2eSupabase } from "./e2e-supabase";

const REAL_MIN_PHON = 1;

let cachedPhon: number | null = null;

/** E2E user real-wallet PHON (integer). Cached per process. */
export async function getE2ePhonBalance(refresh = false): Promise<number> {
  if (!refresh && cachedPhon != null) return cachedPhon;
  const supabase = await getE2eSupabase();
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user) throw userErr ?? new Error("AUTH_REQUIRED");
  const { data, error } = await supabase
    .from("wallet_balances")
    .select("phon")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (error) throw error;
  cachedPhon = Math.floor(Number(data?.phon ?? 0));
  return cachedPhon;
}

export function hasRealBettingBalance(phon: number): boolean {
  return phon >= REAL_MIN_PHON;
}

export { REAL_MIN_PHON };
