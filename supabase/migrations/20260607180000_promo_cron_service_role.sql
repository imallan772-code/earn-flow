-- =============================================================================
-- Promo cron — service_role RPCs (HMAC route → no JWT / no assert_is_admin)
-- + operator admin_users bootstrap (phonara-gb)
-- =============================================================================

INSERT INTO public.admin_users (user_id)
VALUES
  ('e5ab876d-3738-4962-9708-259e33798e13'::uuid),
  ('e29e956b-a821-4b92-a6be-a991c5a86dc3'::uuid)
ON CONFLICT (user_id) DO NOTHING;

-- ─── Due scheduled campaigns (cron scan) ─────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_list_due_promo_campaigns(p_now timestamptz DEFAULT now())
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.scheduled_at), '[]'::json)
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
      WHERE pc.status = 'scheduled'
        AND pc.scheduled_at IS NOT NULL
        AND pc.scheduled_at <= p_now
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cron_list_due_promo_campaigns(timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_list_due_promo_campaigns(timestamptz) FROM anon;
REVOKE ALL ON FUNCTION public.cron_list_due_promo_campaigns(timestamptz) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_list_due_promo_campaigns(timestamptz) TO service_role;

-- ─── Settings for outbound adapters (telegram / webhook) ─────────────────────

CREATE OR REPLACE FUNCTION public.cron_get_promo_settings()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN (SELECT row_to_json(s) FROM public.promo_settings s WHERE s.id = 'default');
END;
$$;

REVOKE ALL ON FUNCTION public.cron_get_promo_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_get_promo_settings() FROM anon;
REVOKE ALL ON FUNCTION public.cron_get_promo_settings() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_get_promo_settings() TO service_role;

-- ─── Dispatch audit (no admin JWT) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_record_promo_dispatch(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.promo_dispatches;
BEGIN
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

REVOKE ALL ON FUNCTION public.cron_record_promo_dispatch(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_record_promo_dispatch(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.cron_record_promo_dispatch(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_record_promo_dispatch(jsonb) TO service_role;

-- ─── Post-dispatch status transition ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_mark_promo_campaign_status(
  p_id text,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RAISE EXCEPTION 'campaign id required';
  END IF;
  IF p_status NOT IN ('draft', 'scheduled', 'publishing', 'done', 'failed') THEN
    RAISE EXCEPTION 'invalid status';
  END IF;
  UPDATE public.promo_campaigns
  SET status = p_status, updated_at = now()
  WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_mark_promo_campaign_status(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cron_mark_promo_campaign_status(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.cron_mark_promo_campaign_status(text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.cron_mark_promo_campaign_status(text, text) TO service_role;
