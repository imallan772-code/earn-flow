/**
 * /api/public/cron/promo-tick — HMAC 검증 + no-op 200.
 * Z-1에서 promo_campaigns scheduled scan + dispatch enqueue.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

function verifyHmac(secret: string, body: string, sig: string | null): boolean {
  if (!sig) return false;
  try {
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/cron/promo-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.PROMO_CRON_SECRET ?? "";
        if (!secret) return new Response("not configured", { status: 503 });
        const body = await request.text();
        const sig = request.headers.get("x-promo-signature");
        if (!verifyHmac(secret, body, sig)) {
          return new Response("invalid signature", { status: 401 });
        }
        return Response.json({ ok: true, ticked: 0, note: "Z-0 stub" });
      },
    },
  },
});

export const __test = { verifyHmac };
