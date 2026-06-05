-- Missions, Events, Trading domain — phonara-gb SSOT
-- Money mutations via SECURITY DEFINER RPC only.

-- ─── Mission templates ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mission_templates (
  id text PRIMARY KEY,
  title text NOT NULL,
  reward bigint NOT NULL CHECK (reward > 0),
  kind text NOT NULL CHECK (kind IN ('daily', 'limited', 'viral', 'onboarding')),
  urgency text,
  total int NOT NULL DEFAULT 1 CHECK (total > 0),
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mission_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY mission_templates_read ON public.mission_templates
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

-- ─── User mission progress ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_missions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mission_id text NOT NULL REFERENCES public.mission_templates(id),
  period_key text NOT NULL DEFAULT 'all',
  progress int NOT NULL DEFAULT 0 CHECK (progress >= 0),
  claimed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, mission_id, period_key)
);

ALTER TABLE public.user_missions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_missions_select_own ON public.user_missions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ─── Events ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.events (
  id text PRIMARY KEY,
  status text NOT NULL CHECK (status IN ('진행중', '예정', '종료')),
  title text NOT NULL,
  tagline text NOT NULL,
  body text NOT NULL,
  reward_preview text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  participants int NOT NULL DEFAULT 0 CHECK (participants >= 0),
  cap int CHECK (cap IS NULL OR cap > 0),
  cta_label text NOT NULL DEFAULT '참여하기',
  terms jsonb NOT NULL DEFAULT '[]'::jsonb,
  bg_from text NOT NULL DEFAULT 'var(--color-purple)',
  bg_to text NOT NULL DEFAULT 'var(--color-pink)',
  progress numeric NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY events_read ON public.events
  FOR SELECT TO authenticated, anon
  USING (is_published = true);

-- ─── Event participants ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_participants (
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_participants_select ON public.event_participants
  FOR SELECT TO authenticated
  USING (true);

-- ─── Event leaderboard ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_leaderboard (
  event_id text NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  rank int NOT NULL CHECK (rank > 0),
  nickname text NOT NULL,
  score numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, rank)
);

ALTER TABLE public.event_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY event_leaderboard_read ON public.event_leaderboard
  FOR SELECT TO authenticated, anon
  USING (true);

-- ─── Markets & candles ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.markets (
  symbol text PRIMARY KEY,
  base_asset text NOT NULL,
  quote_asset text NOT NULL DEFAULT 'USDT',
  tick_size numeric NOT NULL DEFAULT 0.01,
  min_qty numeric NOT NULL DEFAULT 0.001,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;

CREATE POLICY markets_read ON public.markets
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

CREATE TABLE IF NOT EXISTS public.market_candles (
  symbol text NOT NULL REFERENCES public.markets(symbol) ON DELETE CASCADE,
  time bigint NOT NULL,
  open numeric NOT NULL,
  high numeric NOT NULL,
  low numeric NOT NULL,
  close numeric NOT NULL,
  PRIMARY KEY (symbol, time)
);

ALTER TABLE public.market_candles ENABLE ROW LEVEL SECURITY;

CREATE POLICY market_candles_read ON public.market_candles
  FOR SELECT TO authenticated, anon
  USING (true);

-- ─── Trading orders & positions ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trading_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL REFERENCES public.markets(symbol),
  side text NOT NULL CHECK (side IN ('buy', 'sell')),
  qty numeric NOT NULL CHECK (qty > 0),
  fill_price numeric NOT NULL CHECK (fill_price > 0),
  notional numeric NOT NULL CHECK (notional > 0),
  status text NOT NULL DEFAULT 'filled' CHECK (status IN ('open', 'filled', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trading_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY trading_orders_select_own ON public.trading_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.trading_positions (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol text NOT NULL REFERENCES public.markets(symbol),
  qty numeric NOT NULL DEFAULT 0,
  avg_price numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, symbol)
);

ALTER TABLE public.trading_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY trading_positions_select_own ON public.trading_positions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ─── Game round audit log ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.game_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game text NOT NULL,
  round_id text NOT NULL,
  bet_amount bigint NOT NULL DEFAULT 0,
  payout_amount bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, game, round_id)
);

ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY game_rounds_select_own ON public.game_rounds
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- ─── Helpers ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mission_period_key(p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN p_kind = 'daily' THEN to_char((now() AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD')
              ELSE 'all' END;
$$;

-- ─── list_user_missions ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_user_missions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  result json;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT json_agg(row_to_json(t) ORDER BY t.sort_order)
  INTO result
  FROM (
    SELECT
      mt.id,
      mt.title,
      mt.reward,
      mt.kind,
      mt.urgency,
      mt.total,
      mt.sort_order,
      COALESCE(um.progress, 0) AS progress,
      um.claimed_at,
      (COALESCE(um.progress, 0) >= mt.total AND um.claimed_at IS NULL) AS can_claim
    FROM public.mission_templates mt
    LEFT JOIN public.user_missions um
      ON um.mission_id = mt.id
     AND um.user_id = uid
     AND um.period_key = public.mission_period_key(mt.kind)
    WHERE mt.is_active = true
  ) t;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_user_missions() TO authenticated;

-- ─── record_mission_progress ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_mission_progress(
  p_mission_id text,
  p_delta int DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mt public.mission_templates%ROWTYPE;
  pk text;
  um public.user_missions%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_delta <= 0 THEN RAISE EXCEPTION 'invalid delta'; END IF;

  SELECT * INTO mt FROM public.mission_templates WHERE id = p_mission_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission not found'; END IF;

  pk := public.mission_period_key(mt.kind);

  INSERT INTO public.user_missions (user_id, mission_id, period_key, progress)
  VALUES (uid, p_mission_id, pk, LEAST(p_delta, mt.total))
  ON CONFLICT (user_id, mission_id, period_key)
  DO UPDATE SET
    progress = LEAST(public.user_missions.progress + p_delta, mt.total),
    updated_at = now()
  RETURNING * INTO um;

  RETURN json_build_object(
    'mission_id', um.mission_id,
    'progress', um.progress,
    'total', mt.total,
    'can_claim', um.progress >= mt.total AND um.claimed_at IS NULL
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_mission_progress(text, int) TO authenticated;

-- ─── claim_mission_reward ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_mission_reward(p_mission_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mt public.mission_templates%ROWTYPE;
  pk text;
  um public.user_missions%ROWTYPE;
  wal public.wallet_balances%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO mt FROM public.mission_templates WHERE id = p_mission_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'mission not found'; END IF;

  pk := public.mission_period_key(mt.kind);

  SELECT * INTO um FROM public.user_missions
  WHERE user_id = uid AND mission_id = p_mission_id AND period_key = pk
  FOR UPDATE;

  IF NOT FOUND OR um.progress < mt.total THEN
    RAISE EXCEPTION 'mission not complete';
  END IF;
  IF um.claimed_at IS NOT NULL THEN
    RAISE EXCEPTION 'already claimed';
  END IF;

  UPDATE public.user_missions SET claimed_at = now(), updated_at = now()
  WHERE user_id = uid AND mission_id = p_mission_id AND period_key = pk
  RETURNING * INTO um;

  UPDATE public.wallet_balances
  SET phon = phon + mt.reward, updated_at = now()
  WHERE user_id = uid
  RETURNING * INTO wal;

  RETURN json_build_object(
    'reward', mt.reward,
    'balance', row_to_json(wal),
    'mission_id', p_mission_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_mission_reward(text) TO authenticated;

-- ─── list_events ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_events()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.starts_at DESC), '[]'::json)
  FROM (
    SELECT
      id, status, title, tagline, body, reward_preview,
      starts_at, ends_at, participants, cap, cta_label, terms,
      bg_from, bg_to, progress
    FROM public.events
    WHERE is_published = true
  ) e;
$$;

GRANT EXECUTE ON FUNCTION public.list_events() TO authenticated, anon;

-- ─── join_event ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.join_event(p_event_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ev public.events%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT * INTO ev FROM public.events WHERE id = p_event_id AND is_published = true FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'event not found'; END IF;
  IF ev.status = '종료' THEN RAISE EXCEPTION 'event ended'; END IF;
  IF ev.cap IS NOT NULL AND ev.participants >= ev.cap THEN RAISE EXCEPTION 'event full'; END IF;

  INSERT INTO public.event_participants (event_id, user_id)
  VALUES (p_event_id, uid)
  ON CONFLICT DO NOTHING;

  IF NOT FOUND THEN
    SELECT participants, progress INTO ev.participants, ev.progress
    FROM public.events WHERE id = p_event_id;
    RETURN json_build_object('joined', false, 'participants', ev.participants, 'progress', ev.progress);
  END IF;

  UPDATE public.events
  SET participants = participants + 1,
      progress = CASE WHEN cap IS NOT NULL THEN LEAST(1, (participants + 1)::numeric / cap) ELSE progress END
  WHERE id = p_event_id
  RETURNING * INTO ev;

  RETURN json_build_object('joined', true, 'participants', ev.participants, 'progress', ev.progress);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_event(text) TO authenticated;

-- ─── get_event_leaderboard ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_event_leaderboard(p_event_id text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(l) ORDER BY l.rank), '[]'::json)
  FROM (
    SELECT rank, nickname, score
    FROM public.event_leaderboard
    WHERE event_id = p_event_id
  ) l;
$$;

GRANT EXECUTE ON FUNCTION public.get_event_leaderboard(text) TO authenticated, anon;

-- ─── fetch_market_candles ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fetch_market_candles(
  p_symbol text,
  p_limit int DEFAULT 48
)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(c) ORDER BY c.time), '[]'::json)
  FROM (
    SELECT time, open, high, low, close
    FROM public.market_candles
    WHERE symbol = p_symbol
    ORDER BY time DESC
    LIMIT GREATEST(1, LEAST(p_limit, 500))
  ) c;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_market_candles(text, int) TO authenticated, anon;

-- ─── list_user_positions ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_user_positions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  RETURN COALESCE((
    SELECT json_agg(row_to_json(p))
    FROM public.trading_positions p
    WHERE p.user_id = uid AND p.qty > 0
  ), '[]'::json);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_user_positions() TO authenticated;

-- ─── place_market_order ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.place_market_order(
  p_symbol text,
  p_side text,
  p_qty numeric
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  mkt public.markets%ROWTYPE;
  last_close numeric;
  notional numeric;
  wal public.wallet_balances%ROWTYPE;
  pos public.trading_positions%ROWTYPE;
  ord public.trading_orders%ROWTYPE;
  has_pos boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_side NOT IN ('buy', 'sell') THEN RAISE EXCEPTION 'invalid side'; END IF;
  IF p_qty <= 0 THEN RAISE EXCEPTION 'invalid qty'; END IF;

  SELECT * INTO mkt FROM public.markets WHERE symbol = p_symbol AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'market not found'; END IF;
  IF p_qty < mkt.min_qty THEN RAISE EXCEPTION 'qty below minimum'; END IF;

  SELECT close INTO last_close
  FROM public.market_candles
  WHERE symbol = p_symbol
  ORDER BY time DESC
  LIMIT 1;

  IF last_close IS NULL OR last_close <= 0 THEN RAISE EXCEPTION 'no market price'; END IF;

  notional := round(p_qty * last_close, 8);

  SELECT * INTO wal FROM public.wallet_balances WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet not found'; END IF;

  SELECT * INTO pos FROM public.trading_positions
  WHERE user_id = uid AND symbol = p_symbol
  FOR UPDATE;
  has_pos := FOUND;

  IF p_side = 'buy' THEN
    IF wal.usdt < notional THEN RAISE EXCEPTION 'insufficient usdt'; END IF;
    UPDATE public.wallet_balances SET usdt = usdt - notional, updated_at = now()
    WHERE user_id = uid RETURNING * INTO wal;

    IF NOT has_pos THEN
      INSERT INTO public.trading_positions (user_id, symbol, qty, avg_price)
      VALUES (uid, p_symbol, p_qty, last_close);
    ELSE
      UPDATE public.trading_positions
      SET qty = pos.qty + p_qty,
          avg_price = round((pos.qty * pos.avg_price + p_qty * last_close) / (pos.qty + p_qty), 8),
          updated_at = now()
      WHERE user_id = uid AND symbol = p_symbol;
    END IF;
  ELSE
    IF NOT has_pos OR pos.qty < p_qty THEN RAISE EXCEPTION 'insufficient position'; END IF;
    UPDATE public.wallet_balances SET usdt = usdt + notional, updated_at = now()
    WHERE user_id = uid RETURNING * INTO wal;

    IF pos.qty = p_qty THEN
      UPDATE public.trading_positions SET qty = 0, avg_price = 0, updated_at = now()
      WHERE user_id = uid AND symbol = p_symbol;
    ELSE
      UPDATE public.trading_positions SET qty = pos.qty - p_qty, updated_at = now()
      WHERE user_id = uid AND symbol = p_symbol;
    END IF;
  END IF;

  INSERT INTO public.trading_orders (user_id, symbol, side, qty, fill_price, notional, status)
  VALUES (uid, p_symbol, p_side, p_qty, last_close, notional, 'filled')
  RETURNING * INTO ord;

  RETURN json_build_object(
    'order', row_to_json(ord),
    'balance', row_to_json(wal)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.place_market_order(text, text, numeric) TO authenticated;

-- ─── log_game_round (audit) ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_game_round(
  p_game text,
  p_round_id text,
  p_bet_amount bigint DEFAULT 0,
  p_payout_amount bigint DEFAULT 0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  row public.game_rounds%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  INSERT INTO public.game_rounds (user_id, game, round_id, bet_amount, payout_amount)
  VALUES (uid, p_game, p_round_id, p_bet_amount, p_payout_amount)
  ON CONFLICT (user_id, game, round_id) DO UPDATE SET
    bet_amount = EXCLUDED.bet_amount,
    payout_amount = EXCLUDED.payout_amount
  RETURNING * INTO row;

  RETURN row_to_json(row);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_game_round(text, text, bigint, bigint) TO authenticated;

-- ─── Seed: missions (mirror mocks) ─────────────────────────────────────────
INSERT INTO public.mission_templates (id, title, reward, kind, urgency, total, sort_order) VALUES
  ('m-att', '오늘 출석하기', 100, 'daily', '마감 4시간', 1, 1),
  ('m-feed', '피드 글 10개 좋아요', 200, 'daily', NULL, 10, 2),
  ('m-game', '게임 3판 플레이', 500, 'daily', NULL, 3, 3),
  ('m-vir-1', '친구 1명 초대 — 즉시 +5,000 PHON', 5000, 'viral', '남은 자리 47석', 1, 4),
  ('m-lim-1', '한정 미스터리박스 오픈', 3000, 'limited', '마감 임박 ⏳', 1, 5),
  ('m-lim-2', 'TOP 0.01% VIP 챌린지', 50000, 'limited', '오늘만', 1, 6)
ON CONFLICT (id) DO NOTHING;

-- ─── Seed: events (mirror mocks) ───────────────────────────────────────────
INSERT INTO public.events (id, status, title, tagline, body, reward_preview, starts_at, ends_at, participants, cap, cta_label, terms, bg_from, bg_to, progress) VALUES
  ('e-300-bonus', '진행중', '오늘만 300% 가입 보너스', 'TOP 0.01%만 받는 특별 적립',
   '오늘 24시까지 가입한 신규 회원에게 PHON 300%를 즉시 적립합니다. 첫 출금 시 100% 보장.',
   '최대 30,000 PHON', '2026-06-04T00:00:00+09:00', '2026-06-04T23:59:59+09:00', 84281, 100000, '지금 받기',
   '["신규 가입자 한정","1인 1회","출금 시 KYC 필요"]'::jsonb, 'var(--color-purple)', 'var(--color-pink)', 0.72),
  ('e-trade-rank', '진행중', '선물 거래 랭킹전 시즌3', '총 상금 50,000 USDT',
   '수익률 기준 TOP 100에게 USDT 분배. 매일 자정 정산.', '1위 10,000 USDT',
   '2026-06-01T00:00:00+09:00', '2026-06-30T23:59:59+09:00', 12402, NULL, '참여하기',
   '["선물 거래량 1,000 USDT 이상","ROI 기준 정산"]'::jsonb, 'var(--color-cyan)', 'var(--color-purple)', 0.18),
  ('e-attendance-season', '진행중', '28일 출석 시즌 미션', '끝까지 출석하면 1만원 즉시 송금',
   '28일 연속 출석 시 10,000원 KRW 즉시 송금. 중간 보상도 풍성.', '10,000원 + 보너스 PHON',
   '2026-05-15T00:00:00+09:00', '2026-06-11T23:59:59+09:00', 482103, NULL, '출석하기',
   '["일 1회 출석 인정","연속 끊기면 처음부터"]'::jsonb, 'var(--color-gold)', 'var(--color-pink)', 0.85),
  ('e-keepy-uppy-cup', '예정', 'Keepy-Uppy 월드컵', '공차기 챔피언에게 PHON 100만',
   '신규 게임 Keepy-Uppy 정식 토너먼트. 64강 → 결승 토너먼트.', '우승 1,000,000 PHON',
   '2026-06-15T20:00:00+09:00', '2026-06-20T23:00:00+09:00', 3204, NULL, '사전 신청',
   '["계정 1개당 1회","랭킹전 점수 기준 시드"]'::jsonb, 'var(--color-emerald)', 'var(--color-cyan)', 0),
  ('e-may-attendance', '종료', '5월 출석 시즌 보상 정산 완료', '총 PHON 8.2억 지급',
   '5월 시즌 보상 정산이 완료되었습니다. My > 거래내역에서 확인 가능합니다.', '지급 완료',
   '2026-05-01T00:00:00+09:00', '2026-05-31T23:59:59+09:00', 824910, NULL, '내역 보기',
   '["정산 종료"]'::jsonb, 'var(--color-muted-2)', 'var(--color-surface-hi)', 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.event_leaderboard (event_id, rank, nickname, score) VALUES
  ('e-trade-rank', 1, '팬텀트레이더', 482.31),
  ('e-trade-rank', 2, '코인사신', 391.04),
  ('e-trade-rank', 3, '롱숏의신', 287.55),
  ('e-trade-rank', 4, '야수의심장', 244.1),
  ('e-trade-rank', 5, 'BTC왕', 211.78)
ON CONFLICT DO NOTHING;

-- ─── Seed: markets + demo candles ──────────────────────────────────────────
INSERT INTO public.markets (symbol, base_asset, quote_asset, tick_size, min_qty) VALUES
  ('BTCUSDT', 'BTC', 'USDT', 0.01, 0.001),
  ('ETHUSDT', 'ETH', 'USDT', 0.01, 0.01)
ON CONFLICT (symbol) DO NOTHING;

-- Generate 48 demo candles for BTCUSDT (seed from symbol hash)
DO $$
DECLARE
  seed int := 66; -- 'BTCUSDT' char sum mod
  base numeric := 40000 + (seed % 5000);
  t bigint;
  i int;
  open_p numeric;
  close_p numeric;
BEGIN
  t := extract(epoch from now())::bigint;
  FOR i IN 0..47 LOOP
    open_p := base + sin(i / 3.0 + seed) * 120 + i * 2;
    close_p := open_p + cos(i / 2.0 + seed) * 80;
    INSERT INTO public.market_candles (symbol, time, open, high, low, close)
    VALUES (
      'BTCUSDT',
      t - (47 - i) * 300,
      round(open_p, 2),
      round(greatest(open_p, close_p) + 40, 2),
      round(least(open_p, close_p) - 40, 2),
      round(close_p, 2)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Realtime publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.market_candles;
