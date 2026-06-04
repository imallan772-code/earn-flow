# Lovable Export Checklist

GitHub export 직전에 아래 항목을 모두 확인:

- [ ] Lovable preview URL 정상 동작 (모바일 viewport 393×852에서 16개 화면 시각 확인)
- [ ] `src/styles.css` — 토큰만 사용, raw hex 0건
- [ ] `src/features/{auth,landing,onboarding,home,feed,earn,profile,games/*,money-deposit,money-withdrawal,money-transfer,admin,exchange}` 전부 존재
- [ ] `src/shared/{ui,motion,layout,lib}` 전부 존재
- [ ] `src/mocks/{fomo,balance,missions,games}.ts` 전부 존재
- [ ] 6 game VisualShell (crash/rps/slots/lucky-box/roulette/card-flip) + lobby + LiveCashoutStrip 마운트 확인
- [ ] `src/integrations/supabase/README.md` "mock only — merge forbidden" 명시
- [ ] `docs/CURSOR-MERGE-MAP.md` 표 완본 + FOMO 강화 병합 문장 포함
- [ ] `docs/README.md`: "Visual Lab only · no migrations · merge target: phonara-world-main · FOMO 극강 정책"
- [ ] 내부 장치명(`emitFomo`, `FEED_FOMO_*`, "FOMO 트리거") 사용자 카피 노출 0건 (`rg` 확인)
- [ ] Service Worker 등록 0건 (PWA preview 안정성)
- [ ] Supabase migration / RPC / Realtime / Edge / OAuth 호출 0건

## Cursor 이식 순서

1. `src/styles.css` 토큰 + utilities 머지 (본편 SSOT)
2. `src/shared/*` → 본편 `src/components/{ui,premium}/*`로 이식
3. `BottomNav` → 본편 `AppShell.tsx`의 4탭만 교체
4. Landing/Auth/Onboarding 페이지 JSX 교체 (handler는 본편 useAuth/RPC 유지)
5. Feed/Earn/Profile/Lobby JSX 교체
6. 6 게임 VisualShell → `*GameFrozen.tsx`의 visual stage만 교체 (adapter는 본편 유지)
7. money-* 페이지 교체 (form submit은 본편 RPC 유지)
8. Admin 페이지는 본편 admin shell 안에 KPI 카드 영역만 교체
