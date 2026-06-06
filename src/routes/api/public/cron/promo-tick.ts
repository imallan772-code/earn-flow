/**
 * /api/public/cron/promo-tick — HMAC 검증 + dispatchTick 골격.
 * Z-2 v1.3: 실 DB scan은 Cursor TODO (admin_list_promo_campaigns는 assert_is_admin 요구 →
 * cron은 JWT 없음). 여기서는 HMAC verify만 수행하고 0건 응답.
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
        // NOTE: cron route MUST NOT call promoListCampaigns (assert_is_admin RPC).
        // Cursor 큐: service-role read RPC + dispatch fan-out.
        return Response.json({
          ok: true,
          enqueued: 0,
          sent: 0,
          failed: 0,
          note: "CRON_DB_READ_CURSOR_TODO",
        });
      },
    },
  },
});
