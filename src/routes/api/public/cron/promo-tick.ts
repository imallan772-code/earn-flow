/**
 * /api/public/cron/promo-tick — HMAC 검증 + service_role due-campaign dispatch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { verifyPromoCronHmac } from "@/lib/promo/cronHmac";
import { executePromoCronTick } from "@/lib/promo/cronTick.server";

export const Route = createFileRoute("/api/public/cron/promo-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PROMO_CRON_SECRET ?? "";
        if (!secret) return new Response("not configured", { status: 503 });
        const body = await request.text();
        const sig = request.headers.get("x-promo-signature");
        if (!verifyPromoCronHmac(secret, body, sig)) {
          return new Response("invalid signature", { status: 401 });
        }

        try {
          const result = await executePromoCronTick();
          if (!result.ok) {
            return Response.json(result, { status: 503 });
          }
          return Response.json({
            ok: true,
            enqueued: result.enqueued,
            sent: result.sent,
            failed: result.failed,
          });
        } catch (e) {
          const message = e instanceof Error ? e.message : "cron tick failed";
          console.error("[promo-tick]", message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
