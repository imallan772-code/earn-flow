/**
 * GET /api/admin/promo/oauth/$channel/callback — OAuth code exchange → promo_settings.default_utm.
 */
import { createFileRoute } from "@tanstack/react-router";
import {
  promoOAuthChannelsRedirect,
  resolveOAuthApp,
} from "@/lib/promo/oauth/config.server";
import { exchangeOAuthCode } from "@/lib/promo/oauth/exchange.server";
import { persistOAuthTokens } from "@/lib/promo/oauth/persist.server";
import {
  clearOAuthStateCookieHeader,
  readOAuthStateCookie,
} from "@/lib/promo/oauth/stateCookie.server";
import { isOAuthChannel } from "@/lib/promo/oauth/types";

function redirectWithFlash(path: string, query: Record<string, string>, channel: string): Response {
  const url = new URL(path);
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  const secure = url.protocol === "https:" ? "; Secure" : "";
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      "Set-Cookie": `${clearOAuthStateCookieHeader(channel as "x" | "linkedin" | "tiktok")}${secure}`,
      "Cache-Control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/admin/promo/oauth/$channel/callback")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const base = promoOAuthChannelsRedirect();
        if (!isOAuthChannel(params.channel)) {
          return redirectWithFlash(base, { oauth: "error", reason: "invalid_channel" }, params.channel);
        }

        const url = new URL(request.url);
        const err = url.searchParams.get("error");
        if (err) {
          return redirectWithFlash(base, { oauth: "error", reason: err }, params.channel);
        }

        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        if (!code || !state) {
          return redirectWithFlash(base, { oauth: "error", reason: "missing_code" }, params.channel);
        }

        const sealed = readOAuthStateCookie(params.channel, request.headers.get("cookie"));
        if (!sealed || sealed.state !== state || sealed.channel !== params.channel) {
          return redirectWithFlash(base, { oauth: "error", reason: "state_mismatch" }, params.channel);
        }

        const app = resolveOAuthApp(params.channel);
        if (!app) {
          return redirectWithFlash(base, { oauth: "error", reason: "app_not_configured" }, params.channel);
        }

        try {
          const tokens = await exchangeOAuthCode(
            params.channel,
            app,
            code,
            sealed.codeVerifier,
          );
          await persistOAuthTokens(params.channel, tokens);
          return redirectWithFlash(
            base,
            { oauth: "ok", channel: params.channel },
            params.channel,
          );
        } catch (e) {
          const reason = e instanceof Error ? e.message.slice(0, 120) : "exchange_failed";
          return redirectWithFlash(base, { oauth: "error", reason }, params.channel);
        }
      },
    },
  },
});
