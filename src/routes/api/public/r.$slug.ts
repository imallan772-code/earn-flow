/**
 * /api/public/r/$slug — UTM merge → 302.
 * Click insert는 stub log만 (Z-DB record_promo_click RPC 머지 후 Z-1 연결).
 */
import { createFileRoute } from "@tanstack/react-router";
import { mergeUtm } from "@/lib/promo/utm";
import { assertSafeUrl } from "@/lib/promo/ssrf";
import { recordPromoClickServer } from "@/lib/promo/click.server";

export const Route = createFileRoute("/api/public/r/$slug")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const target = url.searchParams.get("u");
        if (!target) return new Response("missing u", { status: 400 });

        let safe: URL;
        try {
          safe = assertSafeUrl(target);
        } catch (e) {
          return new Response((e as Error).message, { status: 400 });
        }

        const utm: Record<string, string> = {
          utm_source: url.searchParams.get("utm_source") ?? "phonara",
          utm_medium: url.searchParams.get("utm_medium") ?? "promo",
          utm_campaign: url.searchParams.get("utm_campaign") ?? params.slug,
        };
        const content = url.searchParams.get("utm_content");
        if (content) utm.utm_content = content;

        const final = mergeUtm(safe.toString(), utm);

        const ch = url.searchParams.get("ch") ?? utm.utm_medium;
        const variant = url.searchParams.get("v") ?? content ?? undefined;
        await recordPromoClickServer({
          slug: params.slug,
          channel: ch ?? undefined,
          variantId: variant,
          referrer: request.headers.get("referer") ?? undefined,
          ua: request.headers.get("user-agent") ?? undefined,
          ip:
            request.headers.get("cf-connecting-ip") ??
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            undefined,
        });

        return new Response(null, {
          status: 302,
          headers: { Location: final, "Cache-Control": "no-store" },
        });
      },
    },
  },
});
