/**
 * /api/public/cron/promo-tick — HMAC 검증 + no-op 200.
 * Z-1에서 promo_campaigns scheduled scan + dispatch enqueue.
 */
import { createFileRoute } from "@tanstack/react-router";
import { verifyPromoCronHmac } from "@/lib/promo/cronHmac";

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
        return Response.json({ ok: true, ticked: 0, note: "Z-0 stub" });
      },
    },
  },
});
