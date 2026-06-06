/**
 * Promo asset upload — service_role → promo-assets bucket (public read).
 */
import { randomUUID } from "node:crypto";
import { getServiceRoleClient } from "@/integrations/supabase/serviceRole.server";

const BUCKET = "promo-assets";

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mimeType] ?? "png";
}

/** Upload generated image bytes; returns public URL or null on failure. */
export async function uploadPromoGeneratedImage(input: {
  base64: string;
  mimeType: string;
  prefix?: string;
}): Promise<string | null> {
  const supabase = getServiceRoleClient();
  if (!supabase) return null;

  const ext = extFromMime(input.mimeType);
  const path = `${input.prefix ?? "generated"}/${Date.now()}-${randomUUID()}.${ext}`;
  const bytes = Buffer.from(input.base64, "base64");

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: input.mimeType,
    upsert: false,
  });
  if (error) {
    console.warn("[promo] storage upload:", error.message);
    return null;
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Persist asset row via service_role direct insert (RLS bypass). */
export async function cronUpsertPromoAsset(input: {
  id: string;
  kind: "image" | "video" | "copy";
  url: string;
  alt?: string;
  prompt?: string;
  campaign_id?: string;
}): Promise<void> {
  const supabase = getServiceRoleClient();
  if (!supabase) return;
  const { error } = await supabase.from("promo_assets").upsert(
    {
      id: input.id,
      kind: input.kind,
      url: input.url,
      alt: input.alt ?? null,
      prompt: input.prompt ?? null,
      campaign_id: input.campaign_id ?? null,
    },
    { onConflict: "id" },
  );
  if (error) console.warn("[promo] cron upsert asset:", error.message);
}
