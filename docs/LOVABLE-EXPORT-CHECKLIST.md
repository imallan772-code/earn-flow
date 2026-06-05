# Lovable Export Checklist

GitHub export 직전에 아래 항목을 모두 확인:

- [ ] Lovable preview URL 정상 동작 (모바일 viewport **390×844**에서 주요 화면 시각 확인 — `docs/LOVABLE_WORK_RULES.md`)
- [ ] `src/styles.css` — `@theme` 토큰만 사용, raw hex 0건
- [ ] `src/features/` — auth, landing, onboarding, feed, earn, profile, games/_, money-_, admin, exchange, event, notice 등 **라운드 범위** 화면 존재
- [ ] `src/shared/` — games, wallet, motion, layout, ui 등 라운드에서 건드린 경로만 깨지지 않았는지
- [ ] `src/mocks/` — 표시용 mock만 (`fomo`, `balance`, `missions`, `gameLobby`, …). **머니/DB 진실 아님**
- [ ] 게임: `GameShell` + `gameRegistry` 패턴, 라우트 `src/routes/_app/games.*.tsx` thin mount
- [ ] `docs/lovable/PROMPT_HEADER.md`를 프롬프트 맨 위에 붙였는지
- [ ] phonara-world-main / phonetok 참조 0건 (`rg phonara-world-main` = 0)
- [ ] Lovable이 `supabase/`, `src/lib/api/`, `src/integrations/supabase/types.ts` 수정 안 했는지
- [ ] 내부 장치명(`emitFomo`, `FEED_FOMO_*`, "FOMO 트리거") 사용자 카피 노출 0건 (`rg` 확인)
- [ ] Service Worker 등록 0건 (PWA preview 안정성 — PWA는 Cursor 전담)
- [ ] Supabase migration / RPC / Realtime / Edge / OAuth 호출 0건

## Cursor pull 후 순서 (earn-flow 본편)

1. `git pull origin main`
2. `bun run check`
3. `docs/CURSOR_SANITATION_CHECKLIST.md` grep 감사
4. FAIL 항목 Cursor에서 수정 (Lovable에 되돌리지 않음)
5. Supabase 필요 시 `docs/SUPABASE_AUTOMATION_RULES.md`
6. `docs/lovable/ROUND_REPORT_TEMPLATE.md`로 라운드 보고
