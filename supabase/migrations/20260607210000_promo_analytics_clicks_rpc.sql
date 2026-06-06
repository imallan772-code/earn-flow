-- =============================================================================
-- Z-4: admin_list_promo_clicks + date-range admin_promo_analytics_summary
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_list_promo_clicks(
  p_campaign_id text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
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
        id,
        campaign_id,
        variant_id,
        channel,
        referrer,
        created_at
      FROM public.promo_clicks
      WHERE (p_campaign_id IS NULL OR campaign_id = p_campaign_id)
        AND (p_from IS NULL OR created_at >= p_from)
        AND (p_to IS NULL OR created_at <= p_to)
    ) c
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_promo_clicks(text, timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_promo_clicks(text, timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_promo_clicks(text, timestamptz, timestamptz) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_promo_analytics_summary();

CREATE OR REPLACE FUNCTION public.admin_promo_analytics_summary(
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN json_build_object(
    'sent', (
      SELECT count(*)::int
      FROM public.promo_dispatches d
      WHERE d.status = 'sent'
        AND (p_from IS NULL OR d.sent_at >= p_from)
        AND (p_to IS NULL OR d.sent_at <= p_to)
    ),
    'clicks', (
      SELECT count(*)::int
      FROM public.promo_clicks c
      WHERE (p_from IS NULL OR c.created_at >= p_from)
        AND (p_to IS NULL OR c.created_at <= p_to)
    ),
    'campaigns', (SELECT count(*)::int FROM public.promo_campaigns),
    'top_channel', (
      SELECT channel
      FROM public.promo_clicks c
      WHERE (p_from IS NULL OR c.created_at >= p_from)
        AND (p_to IS NULL OR c.created_at <= p_to)
      GROUP BY channel
      ORDER BY count(*) DESC
      LIMIT 1
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_promo_analytics_summary(timestamptz, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_promo_analytics_summary(timestamptz, timestamptz) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_promo_analytics_summary(timestamptz, timestamptz) TO authenticated;
