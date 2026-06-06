-- =============================================================================
-- Part 3: Live feed privacy — anon never reads user_id; authenticated keeps isMe
-- =============================================================================

REVOKE SELECT ON public.live_bets FROM anon, authenticated;

GRANT SELECT (
  id,
  event_key,
  display_name,
  game,
  amount,
  multiplier,
  profit,
  status,
  mode,
  created_at,
  updated_at
) ON public.live_bets TO anon;

GRANT SELECT ON public.live_bets TO authenticated;

CREATE INDEX IF NOT EXISTS idx_live_bets_user_id
  ON public.live_bets (user_id);
