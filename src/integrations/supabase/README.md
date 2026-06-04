# Supabase integration — mock only · merge forbidden

이 디렉토리는 **Lovable Visual Lab 프로젝트**의 자동 통합 파일입니다.

- **절대 본편 `phonara-world-main`에 export 하지 않습니다.**
- 본 프로젝트의 모든 데이터는 `src/mocks/*` 모듈에서만 제공됩니다.
- Lovable 코드에서 이 디렉토리를 import 하지 않습니다.
- migration / RPC / Realtime / Edge / 실제 OAuth 전부 금지.

## Cursor merge 시

본편 `src/integrations/supabase/`를 그대로 유지하세요. Lovable 산출물에서 이식하는 것은 JSX/className/motion 뿐이며, 모든 핸들러는 본편의 기존 `useGameWallet`, `useAuth`, RPC에 reconnect 합니다.
