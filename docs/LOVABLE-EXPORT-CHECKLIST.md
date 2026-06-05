# Lovable Export Checklist

GitHub export 직전에 아래 항목을 모두 확인:

- [ ] Lovable preview URL 정상 동작 (모바일 viewport 393×852에서 16개 화면 시각 확인)
- [ ] `src/styles.css` — 토큰만 사용, raw hex 0건
- [ ] `src/features/{auth,landing,onboarding,home,feed,earn,profile,games/*,money-deposit,money-withdrawal,money-transfer,admin,exchange}` 전부 존재
- [ ] `src/shared/{ui,motion,layout,lib}` 전부 존재
- [ ] `src/mocks/{fomo,balance,missions,games}.ts` 전부 존재
- [ ] 6 game VisualShell (crash/rps/slots/lucky-box/roulette/card-flip) + lobby + LiveCashoutStrip 마운트 확인
- [ ] `docs/lovable/PROMPT_HEADER.md`를 프롬프트 맨 위에 붙였는지
- [ ] phonara-world-main / phonetok 참조 0건 (`rg phonara-world-main` = 0, deprecated 문서 제외)
- [ ] Lovable이 `supabase/`, `src/lib/api/`, `types.ts` 수정 안 했는지
- [ ] 내부 장치명(`emitFomo`, `FEED_FOMO_*`, "FOMO 트리거") 사용자 카피 노출 0건 (`rg` 확인)
- [ ] Service Worker 등록 0건 (PWA preview 안정성)
- [ ] Supabase migration / RPC / Realtime / Edge / OAuth 호출 0건

## Cursor pull 후 순서 (earn-flow 본편)

1. `git pull origin main`
2. `bun run check`
3. `docs/CURSOR_SANITATION_CHECKLIST.md` grep 감사
4. FAIL 항목 Cursor에서 수정 (Lovable에 되돌리지 않음)
5. Supabase 필요 시 `docs/SUPABASE_AUTOMATION_RULES.md`
6. `docs/lovable/ROUND_REPORT_TEMPLATE.md`로 라운드 보고
