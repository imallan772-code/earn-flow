-- =============================================================================
-- Admin platform — notices SSOT, admin_users RBAC, admin RPCs (phonara-gb)
-- =============================================================================
-- Public read: list_notices (published only), list_events (unchanged)
-- Admin write: SECURITY DEFINER RPCs gated by admin_users + auth.uid()
-- Bootstrap: INSERT INTO admin_users (user_id) VALUES ('<your-auth-uuid>');
-- =============================================================================

-- ─── Admin allowlist (server-side truth; never use user_metadata for authz) ─
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- No direct client policies — membership checked only inside admin RPCs.

-- ─── Notices ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notices (
  id text PRIMARY KEY,
  category text NOT NULL CHECK (category IN ('공지', '업데이트', '점검', '보안')),
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL,
  author text NOT NULL DEFAULT 'PHONARA 운영팀',
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY notices_public_read ON public.notices
  FOR SELECT TO authenticated, anon
  USING (is_published = true);

-- ─── assert_is_admin ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assert_is_admin()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = uid) THEN
    RAISE EXCEPTION 'admin required';
  END IF;
  RETURN uid;
END;
$$;

REVOKE ALL ON FUNCTION public.assert_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assert_is_admin() TO authenticated;

-- ─── is_admin (client gate) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ─── list_notices (public) ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_notices()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(n) ORDER BY n.pinned DESC, n.published_at DESC), '[]'::json)
  FROM (
    SELECT
      id, category, title, excerpt, body, pinned,
      published_at, author, is_published
    FROM public.notices
    WHERE is_published = true
  ) n;
$$;

GRANT EXECUTE ON FUNCTION public.list_notices() TO authenticated, anon;

-- ─── admin_list_notices ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_notices()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(n) ORDER BY n.pinned DESC, n.published_at DESC), '[]'::json)
    FROM (
      SELECT
        id, category, title, excerpt, body, pinned,
        published_at, author, is_published, created_at, updated_at
      FROM public.notices
    ) n
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_notices() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_notices() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_notices() TO authenticated;

-- ─── admin_upsert_notice ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_upsert_notice(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.notices%ROWTYPE;
BEGIN
  PERFORM public.assert_is_admin();

  INSERT INTO public.notices (
    id, category, title, excerpt, body, pinned,
    published_at, author, is_published, updated_at
  )
  VALUES (
    p_payload->>'id',
    p_payload->>'category',
    p_payload->>'title',
    COALESCE(p_payload->>'excerpt', ''),
    COALESCE(p_payload->>'body', ''),
    COALESCE((p_payload->>'pinned')::boolean, false),
    (p_payload->>'published_at')::timestamptz,
    COALESCE(p_payload->>'author', 'PHONARA 운영팀'),
    COALESCE((p_payload->>'is_published')::boolean, true),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    category = EXCLUDED.category,
    title = EXCLUDED.title,
    excerpt = EXCLUDED.excerpt,
    body = EXCLUDED.body,
    pinned = EXCLUDED.pinned,
    published_at = EXCLUDED.published_at,
    author = EXCLUDED.author,
    is_published = EXCLUDED.is_published,
    updated_at = now()
  RETURNING * INTO row;

  RETURN row_to_json(row);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_notice(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_notice(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_notice(jsonb) TO authenticated;

-- ─── admin_delete_notice ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_notice(p_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  DELETE FROM public.notices WHERE id = p_id;
  RETURN json_build_object('deleted', true, 'id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_notice(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_notice(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_notice(text) TO authenticated;

-- ─── admin_list_events ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_events()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  RETURN (
    SELECT COALESCE(json_agg(row_to_json(e) ORDER BY e.starts_at DESC), '[]'::json)
    FROM (
      SELECT
        id, status, title, tagline, body, reward_preview,
        starts_at, ends_at, participants, cap, cta_label, terms,
        bg_from, bg_to, progress, is_published, created_at
      FROM public.events
    ) e
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_events() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_list_events() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_list_events() TO authenticated;

-- ─── admin_upsert_event ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_upsert_event(p_payload jsonb)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.events%ROWTYPE;
  terms_json jsonb;
BEGIN
  PERFORM public.assert_is_admin();

  terms_json := COALESCE(p_payload->'terms', '[]'::jsonb);
  IF jsonb_typeof(terms_json) <> 'array' THEN
    terms_json := jsonb_build_array(terms_json::text);
  END IF;

  INSERT INTO public.events (
    id, status, title, tagline, body, reward_preview,
    starts_at, ends_at, participants, cap, cta_label, terms,
    bg_from, bg_to, progress, is_published
  )
  VALUES (
    p_payload->>'id',
    p_payload->>'status',
    p_payload->>'title',
    p_payload->>'tagline',
    COALESCE(p_payload->>'body', ''),
    COALESCE(p_payload->>'reward_preview', ''),
    (p_payload->>'starts_at')::timestamptz,
    (p_payload->>'ends_at')::timestamptz,
    COALESCE((p_payload->>'participants')::int, 0),
    NULLIF(p_payload->>'cap', '')::int,
    COALESCE(p_payload->>'cta_label', '참여하기'),
    terms_json,
    COALESCE(p_payload->>'bg_from', 'var(--color-purple)'),
    COALESCE(p_payload->>'bg_to', 'var(--color-pink)'),
    COALESCE((p_payload->>'progress')::numeric, 0),
    COALESCE((p_payload->>'is_published')::boolean, true)
  )
  ON CONFLICT (id) DO UPDATE SET
    status = EXCLUDED.status,
    title = EXCLUDED.title,
    tagline = EXCLUDED.tagline,
    body = EXCLUDED.body,
    reward_preview = EXCLUDED.reward_preview,
    starts_at = EXCLUDED.starts_at,
    ends_at = EXCLUDED.ends_at,
    participants = EXCLUDED.participants,
    cap = EXCLUDED.cap,
    cta_label = EXCLUDED.cta_label,
    terms = EXCLUDED.terms,
    bg_from = EXCLUDED.bg_from,
    bg_to = EXCLUDED.bg_to,
    progress = EXCLUDED.progress,
    is_published = EXCLUDED.is_published
  RETURNING * INTO row;

  RETURN row_to_json(row);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_upsert_event(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_upsert_event(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_upsert_event(jsonb) TO authenticated;

-- ─── admin_delete_event ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_delete_event(p_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_is_admin();
  DELETE FROM public.events WHERE id = p_id;
  RETURN json_build_object('deleted', true, 'id', p_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_event(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_delete_event(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_event(text) TO authenticated;

-- ─── admin_dashboard_stats ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  total_users bigint;
  signups_today bigint;
  published_events bigint;
  published_notices bigint;
BEGIN
  PERFORM public.assert_is_admin();

  SELECT COUNT(*) INTO total_users FROM public.profiles;
  SELECT COUNT(*) INTO signups_today
    FROM public.profiles
    WHERE created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Seoul');
  SELECT COUNT(*) INTO published_events FROM public.events WHERE is_published = true;
  SELECT COUNT(*) INTO published_notices FROM public.notices WHERE is_published = true;

  RETURN json_build_object(
    'total_users', total_users,
    'signups_today', signups_today,
    'published_events', published_events,
    'published_notices', published_notices
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

-- ─── Seed notices (mirror mocks) ───────────────────────────────────────────
INSERT INTO public.notices (id, category, title, excerpt, body, pinned, published_at, author) VALUES
  ('n-2026-06-01', '공지', 'PHONARA 2.0 정식 오픈 — 300% 가입 보너스',
   '오늘 가입하시면 PHON 300%를 즉시 적립해 드립니다. 단, 오늘만!',
   E'PHONARA 2.0이 정식 오픈했습니다.\n\n· 300% 가입 보너스 (오늘 24시까지)\n· 출석 7일 streak 보너스 2배\n· 신규 게임 8종 동시 오픈\n\n지금 바로 시작하세요.',
   true, '2026-06-04T09:00:00+09:00', 'PHONARA 운영팀'),
  ('n-2026-06-03', '보안', '보안 강화 안내 — 2FA 의무화',
   '6월 15일부터 출금 시 2FA가 의무화됩니다.',
   '안전한 자산 보호를 위해 출금 시 2FA(이중 인증)가 의무화됩니다. 미설정 계정은 출금이 제한됩니다.',
   true, '2026-06-03T18:00:00+09:00', '보안팀'),
  ('n-2026-06-02', '업데이트', '선물 거래 — 125x 레버리지 오픈',
   'Bybit급 선물 터미널이 정식 런칭되었습니다.',
   'Hedge / One-way 모드, Cross / Isolated 마진, Multi-Asset Mode, Sub-account 모두 지원합니다.',
   false, '2026-06-02T12:00:00+09:00', '거래소팀'),
  ('n-2026-06-01b', '점검', '정기 점검 안내 (6/10 03:00~04:00)',
   '약 1시간 동안 입출금이 일시 중단됩니다.',
   '6월 10일 새벽 3시부터 4시까지 정기 점검을 진행합니다. 거래는 정상 작동, 입출금만 일시 중단됩니다.',
   false, '2026-06-01T10:00:00+09:00', '운영팀'),
  ('n-2026-05-30', '공지', '친구초대 보상 다단계 시즌2 시작',
   '3단계 다단계 리워드로 업그레이드되었습니다.',
   '1단계 10% / 2단계 3% / 3단계 1% 평생 리워드. 만원 송금 마일스톤 동시 진행.',
   false, '2026-05-30T15:00:00+09:00', '운영팀'),
  ('n-2026-05-28', '업데이트', 'Keepy-Uppy(공차기) 게임 추가',
   '틱톡 공차기 스타일 미니게임이 추가되었습니다.',
   '콤보 ×2/×5/×10 시스템, 리더보드 시즌제 운영.',
   false, '2026-05-28T11:00:00+09:00', '게임팀')
ON CONFLICT (id) DO NOTHING;

ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
