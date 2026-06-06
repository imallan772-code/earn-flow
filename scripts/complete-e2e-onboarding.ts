#!/usr/bin/env bun
/**
 * Complete onboarding for the E2E test user via complete_onboarding_step RPC.
 * Usage: bun run test:e2e:complete-onboarding
 */
import { createClient } from "@supabase/supabase-js";
import { getE2eCredentials, hasE2eCredentials, requireEnv } from "../e2e/utils/env";

const NICKNAME = "E2E_Player";

if (!hasE2eCredentials()) {
  console.error("Missing E2E_USER_EMAIL / E2E_USER_PASSWORD in .env");
  process.exit(1);
}

const creds = getE2eCredentials()!;
const url = requireEnv("VITE_SUPABASE_URL");
const anonKey = requireEnv("VITE_SUPABASE_ANON_KEY");

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
  email: creds.email,
  password: creds.password,
});
if (signInErr || !signIn.session) {
  console.error("Sign-in failed:", signInErr?.message ?? "no session");
  process.exit(1);
}

const userId = signIn.session.user.id;
console.log("Signed in:", creds.email);

const { data: profile, error: profileErr } = await supabase
  .from("profiles")
  .select("onboarding_step, onboarding_completed, nickname")
  .eq("id", userId)
  .maybeSingle();

if (profileErr) {
  console.error("Profile fetch failed:", profileErr.message);
  process.exit(1);
}

if (profile?.onboarding_completed) {
  console.log("Onboarding already completed (nickname:", profile.nickname ?? "—", ")");
  process.exit(0);
}

const startStep = profile?.onboarding_step ?? 0;
console.log("Current onboarding_step:", startStep);

for (let step = startStep; step < 4; step++) {
  const { data, error } = await supabase.rpc("complete_onboarding_step", {
    p_step_index: step,
    p_nickname: step === 1 ? NICKNAME : undefined,
  });
  if (error) {
    console.error(`Step ${step} failed:`, error.message);
    process.exit(1);
  }
  const reward = (data as { reward?: number })?.reward ?? 0;
  console.log(`✓ Step ${step} complete (+${reward} PHON)`);
}

const { data: after } = await supabase
  .from("profiles")
  .select("onboarding_completed, onboarding_step, nickname")
  .eq("id", userId)
  .single();

console.log("Done:", after);
if (!after?.onboarding_completed) {
  console.error("onboarding_completed still false");
  process.exit(1);
}

console.log("E2E user ready for logout test.");
