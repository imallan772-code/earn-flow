-- =============================================================================
-- Promo Engine — campaigns, variants, dispatches, clicks, assets, settings
-- phonara-gb · admin RPCs + public record_promo_click
-- =============================================================================

-- ─── Tables ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.promo_campaigns (
  id text PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  target_url text NOT NULL DEFAULT '',
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  goal text,
  audience text,
  tone numeric,
  length text,
  channels text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'publishing', 'done', 'failed')),
  scheduled_at timestamptz,
  risk_score numeric NOT NULL DEFAULT 0,
  hero_asset_id text,
  ab_ratio numeric NOT NULL DEFAULT 0.5 CHECK (ab_ratio >= 0 AND ab_ratio <= 1),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_campaigns_scheduled_idx
  ON public.promo_campaigns (scheduled_at)
  WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS public.promo_variants (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'A',
  channel text NOT NULL,
  body text NOT NULL DEFAULT '',
  hashtags text[] NOT NULL DEFAULT '{}',
  cta text,
  weight numeric NOT NULL DEFAULT 1,
  image_url text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_variants_campaign_idx
  ON public.promo_variants (campaign_id);

CREATE TABLE IF NOT EXISTS public.promo_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  variant_id text REFERENCES public.promo_variants(id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  external_id text,
  error text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS promo_dispatches_idempotency_idx
  ON public.promo_dispatches (campaign_id, variant_id, channel)
  WHERE status = 'sent';

CREATE INDEX IF NOT EXISTS promo_dispatches_campaign_idx
  ON public.promo_dispatches (campaign_id, sent_at DESC);

CREATE TABLE IF NOT EXISTS public.promo_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id text NOT NULL REFERENCES public.promo_campaigns(id) ON DELETE CASCADE,
  variant_id text,
  channel text NOT NULL DEFAULT 'unknown',
  ua_hash text,
  ip_hash text,
  referrer text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_clicks_campaign_created_idx
  ON public.promo_clicks (campaign_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.promo_assets (
  id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('image', 'video', 'copy')),
  url text NOT NULL DEFAULT '',
  alt text,
  prompt text,
  campaign_id text REFERENCES public.promo_campaigns(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promo_settings (
  id text PRIMARY KEY DEFAULT 'default',
  brand_voice text NOT NULL DEFAULT '',
  banned_words text[] NOT NULL DEFAULT '{}',
  default_utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  quiet_hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  ab_ratio numeric NOT NULL DEFAULT 0.5 CHECK (ab_ratio >= 0 AND ab_ratio <= 1),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.promo_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ─── RLS (no direct client access — RPC only) ───────────────────────────────

ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.promo_campaigns FROM anon, authenticated;
REVOKE ALL ON public.promo_variants FROM anon, authenticated;
REVOKE ALL ON public.promo_dispatches FROM anon, authenticated;
REVOKE ALL ON public.promo_clicks FROM anon, authenticated;
REVOKE ALL ON public.promo_assets FROM anon, authenticated;
REVOKE ALL ON public.promo_settings FROM anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_campaigns TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_variants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_dispatches TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_clicks TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promo_settings TO service_role;

-- ─── Public click tracking (no auth) ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.record_promo_click(
  p_slug text,
  p_channel text DEFAULT 'unknown',
  p_variant_id text DEFAULT NULL,
  p_referrer text DEFAULT NULL,
  p_ua_hash text DEFAULT NULL,
  p_ip_hash text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid text;
  click_id uuid;
BEGIN
  IF p_slug IS NULL OR length(trim(p_slug)) = 0 THEN
    RAISE EXCEPTION 'slug required';
  END IF;

  SELECT id INTO cid
  FROM public.promo_campaigns
  WHERE slug = p_slug
  LIMIT 1;

  IF cid IS NULL THEN
    RAISE EXCEPTION 'campaign not found';
  END IF;

  INSERT INTO public.promo_clicks (
    campaign_id, variant_id, channel, referrer, ua_hash, ip_hash
  )
  VALUES (
    cid,
    NULLIF(trim(p_variant_id), ''),
    COALESCE(NULLIF(trim(p_channel), ''), 'unknown'),
    NULLIF(trim(p_referrer), ''),
    NULLIF(trim(p_ua_hash), ''),
    NULLIF(trim(p_ip_hash), '')
  )
  RETURNING id INTO click_id;

  RETURN click_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_promo_click(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_promo_click(text, text, text, text, text, text)
  TO anon, authenticated, service_role;

-- ─── Admin RPCs ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.admin_list_promo_campaigns()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.created_at DESC), '[]'::json)
    FROM (
      SELECT
        pc.*,
        COALESCE(
          (
            SELECT json_agg(row_to_json(v) ORDER BY v.label, v.channel)
            FROM public.promo_variants v
            WHERE v.campaign_id = pc.id
          ),
          '[]'::json
        ) AS variants
      FROM public.promo_campaigns pc
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_promo_campaigns() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_promo_campaigns() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_campaigns() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_promo_campaign(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  cid text;
  variants jsonb;
  v jsonb;
BEGIN
  uid := public.assert_is_admin();

  cid := COALESCE(p_payload->>'id', p_payload->>'slug');
  IF cid IS NULL OR length(trim(cid)) = 0 THEN
    RAISE EXCEPTION 'id or slug required';
  END IF;

  INSERT INTO public.promo_campaigns (
    id, slug, title, target_url, brief, goal, audience, tone, length,
    channels, status, scheduled_at, risk_score, hero_asset_id, ab_ratio, created_by
  )
  VALUES (
    cid,
    COALESCE(NULLIF(p_payload->>'slug', ''), cid),
    COALESCE(p_payload->>'title', ''),
    COALESCE(p_payload->>'target_url', p_payload->>'targetUrl', ''),
    COALESCE(p_payload->'brief', '{}'::jsonb),
    p_payload->>'goal',
    p_payload->>'audience',
    NULLIF(p_payload->>'tone', '')::numeric,
    p_payload->>'length',
    COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'channels', '[]'::jsonb))),
      '{}'::text[]
    ),
    COALESCE(p_payload->>'status', 'draft'),
    NULLIF(p_payload->>'scheduled_at', '')::timestamptz,
    COALESCE(NULLIF(p_payload->>'risk_score', '')::numeric, 0),
    p_payload->>'hero_asset_id',
    COALESCE(NULLIF(p_payload->>'ab_ratio', '')::numeric, 0.5),
    uid
  )
  ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    target_url = EXCLUDED.target_url,
    brief = EXCLUDED.brief,
    goal = EXCLUDED.goal,
    audience = EXCLUDED.audience,
    tone = EXCLUDED.tone,
    length = EXCLUDED.length,
    channels = EXCLUDED.channels,
    status = EXCLUDED.status,
    scheduled_at = EXCLUDED.scheduled_at,
    risk_score = EXCLUDED.risk_score,
    hero_asset_id = EXCLUDED.hero_asset_id,
    ab_ratio = EXCLUDED.ab_ratio,
    updated_at = now();

  variants := COALESCE(p_payload->'variants', '[]'::jsonb);
  DELETE FROM public.promo_variants WHERE campaign_id = cid;

  FOR v IN SELECT * FROM jsonb_array_elements(variants)
  LOOP
    INSERT INTO public.promo_variants (
      id, campaign_id, label, channel, body, hashtags, cta, weight, image_url, utm
    )
    VALUES (
      COALESCE(v->>'id', gen_random_uuid()::text),
      cid,
      COALESCE(v->>'label', 'A'),
      COALESCE(v->>'channel', 'copy'),
      COALESCE(v->>'body', ''),
      COALESCE(
        ARRAY(SELECT jsonb_array_elements_text(COALESCE(v->'hashtags', '[]'::jsonb))),
        '{}'::text[]
      ),
      v->>'cta',
      COALESCE(NULLIF(v->>'weight', '')::numeric, 1),
      v->>'image_url',
      COALESCE(v->'utm', '{}'::jsonb)
    );
  END LOOP;

  RETURN (
    SELECT row_to_json(c)
    FROM (
      SELECT pc.*,
        COALESCE(
          (SELECT json_agg(row_to_json(vv) ORDER BY vv.label, vv.channel)
           FROM public.promo_variants vv WHERE vv.campaign_id = pc.id),
          '[]'::json
        ) AS variants
      FROM public.promo_campaigns pc
      WHERE pc.id = cid
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_promo_campaign(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_promo_campaign(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_promo_campaign(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_promo_campaign(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  DELETE FROM public.promo_campaigns WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_promo_campaign(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_promo_campaign(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_promo_campaign(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_promo_dispatches(p_campaign_id text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(d) ORDER BY d.sent_at DESC), '[]'::json)
    FROM (
      SELECT *
      FROM public.promo_dispatches
      WHERE p_campaign_id IS NULL OR campaign_id = p_campaign_id
    ) d
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_promo_dispatches(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_promo_dispatches(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_dispatches(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_promo_dispatch(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.promo_dispatches;
BEGIN
  PERFORM public.assert_is_admin();
  INSERT INTO public.promo_dispatches (
    campaign_id, variant_id, channel, status, external_id, error, sent_at
  )
  VALUES (
    p_payload->>'campaign_id',
    NULLIF(p_payload->>'variant_id', ''),
    COALESCE(p_payload->>'channel', 'copy'),
    COALESCE(p_payload->>'status', 'sent'),
    p_payload->>'external_id',
    p_payload->>'error',
    COALESCE(NULLIF(p_payload->>'sent_at', '')::timestamptz, now())
  )
  RETURNING * INTO row;
  RETURN row_to_json(row);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_record_promo_dispatch(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_record_promo_dispatch(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_record_promo_dispatch(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_promo_assets()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(a) ORDER BY a.created_at DESC), '[]'::json)
    FROM public.promo_assets a
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_promo_assets() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_promo_assets() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_assets() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_promo_asset(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  aid text;
BEGIN
  uid := public.assert_is_admin();
  aid := COALESCE(p_payload->>'id', gen_random_uuid()::text);

  INSERT INTO public.promo_assets (id, kind, url, alt, prompt, campaign_id, created_by)
  VALUES (
    aid,
    COALESCE(p_payload->>'kind', 'image'),
    COALESCE(p_payload->>'url', ''),
    p_payload->>'alt',
    p_payload->>'prompt',
    NULLIF(p_payload->>'campaign_id', ''),
    uid
  )
  ON CONFLICT (id) DO UPDATE SET
    kind = EXCLUDED.kind,
    url = EXCLUDED.url,
    alt = EXCLUDED.alt,
    prompt = EXCLUDED.prompt,
    campaign_id = EXCLUDED.campaign_id;

  RETURN (SELECT row_to_json(a) FROM public.promo_assets a WHERE a.id = aid);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_promo_asset(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_promo_asset(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_promo_asset(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_promo_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN (SELECT row_to_json(s) FROM public.promo_settings s WHERE s.id = 'default');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_promo_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_promo_settings() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_get_promo_settings() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_upsert_promo_settings(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_is_admin();

  UPDATE public.promo_settings SET
    brand_voice = COALESCE(p_payload->>'brand_voice', brand_voice),
    banned_words = COALESCE(
      ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload->'banned_words', '[]'::jsonb))),
      banned_words
    ),
    default_utm = COALESCE(p_payload->'default_utm', default_utm),
    quiet_hours = COALESCE(p_payload->'quiet_hours', quiet_hours),
    ab_ratio = COALESCE(NULLIF(p_payload->>'ab_ratio', '')::numeric, ab_ratio),
    updated_at = now()
  WHERE id = 'default';

  RETURN (SELECT row_to_json(s) FROM public.promo_settings s WHERE s.id = 'default');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_promo_settings(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_promo_settings(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_promo_settings(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_promo_analytics_summary()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN json_build_object(
    'sent', (SELECT count(*)::int FROM public.promo_dispatches WHERE status = 'sent'),
    'clicks', (SELECT count(*)::int FROM public.promo_clicks),
    'campaigns', (SELECT count(*)::int FROM public.promo_campaigns),
    'top_channel', (
      SELECT channel FROM public.promo_clicks
      GROUP BY channel ORDER BY count(*) DESC LIMIT 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_promo_analytics_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_promo_analytics_summary() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_promo_analytics_summary() TO authenticated;

-- ─── Storage bucket (public read for promo hero images) ─────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promo-assets',
  'promo-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS promo_assets_public_read ON storage.objects;
DROP POLICY IF EXISTS promo_assets_admin_write ON storage.objects;
DROP POLICY IF EXISTS promo_assets_admin_update ON storage.objects;
DROP POLICY IF EXISTS promo_assets_admin_delete ON storage.objects;

CREATE POLICY promo_assets_public_read ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'promo-assets');

CREATE POLICY promo_assets_admin_write ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'promo-assets'
    AND public.is_admin()
  );

CREATE POLICY promo_assets_admin_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'promo-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'promo-assets' AND public.is_admin());

CREATE POLICY promo_assets_admin_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'promo-assets' AND public.is_admin());

-- pg_cron: enable pg_cron + pg_net in Dashboard, then schedule HTTP POST to
-- {APP_URL}/api/public/cron/promo-tick with x-promo-signature HMAC (see promo-tick route).
