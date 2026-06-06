/**
 * POST /api/admin/promo/oauth/$channel/start — admin Bearer gate → OAuth provider redirect.
 */
import { createFileRoute } from "@tanstack/react-router";
import { resolveAdminPrincipal } from "@/lib/promo/adminGate.server";
import { buildAuthorizeUrl } from "@/lib/promo/oauth/exchange.server";
import { resolveOAuthApp, oauthStateSecret } from "@/lib/promo/oauth/config.server";
import { newOAuthState } from "@/lib/promo/oauth/pkce.server";
import { buildOAuthStateCookie } from "@/lib/promo/oauth/stateCookie.server";
import { isOAuthChannel } from "@/lib/promo/oauth/types";

export const Route = createFileRoute("/api/admin/promo/oauth/$channel/start")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        if (!isOAuthChannel(params.channel)) {
          return new Response(JSON.stringify({ ok: false, code: "INVALID_CHANNEL" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const principal = await resolveAdminPrincipal(request);
        if (principal instanceof Response) return principal;

        if (!oauthStateSecret()) {
          return new Response(JSON.stringify({ ok: false, code: "OAUTH_STATE_SECRET_MISSING" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const app = resolveOAuthApp(params.channel);
        if (!app) {
          return new Response(JSON.stringify({ ok: false, code: "OAUTH_APP_NOT_CONFIGURED" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { state, codeVerifier, codeChallenge } = newOAuthState();
        const cookie = buildOAuthStateCookie(params.channel, {
          channel: params.channel,
          state,
          codeVerifier,
          userId: principal.userId,
          exp: Date.now() + 600_000,
        });
        if (!cookie) {
          return new Response(JSON.stringify({ ok: false, code: "OAUTH_STATE_SECRET_MISSING" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }

        const location = buildAuthorizeUrl(params.channel, app, state, codeChallenge);
        const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
        return new Response(null, {
          status: 302,
          headers: {
            Location: location,
            "Set-Cookie": `${cookie.name}=${cookie.value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${cookie.maxAge}${secure}`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
