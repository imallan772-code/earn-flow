/**
 * /api/admin/promo/image-stream — admin-gated SSE image generation.
 * Z-2 v1.3: assertAdminRequest (is_admin RPC) → 401 JSON before stream.
 */
import { createFileRoute } from "@tanstack/react-router";
import { randomUUID } from "node:crypto";
import { cronUpsertPromoAsset, uploadPromoGeneratedImage } from "@/lib/api/promo/storage.server";
import { assertAdminRequest } from "@/lib/promo/adminGate.server";
import { streamPromoImage } from "@/lib/promo/image.server";

function sseEvent(name: string, payload: unknown): string {
  return `event: ${name}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export const Route = createFileRoute("/api/admin/promo/image-stream")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // FAIL RULE: stream MUST NOT start before admin gate passes.
        const denied = await assertAdminRequest(request);
        if (denied) return denied;

        let prompt = "";
        try {
          const body = (await request.json()) as { prompt?: string };
          prompt = String(body?.prompt ?? "").slice(0, 800).trim();
        } catch {
          /* ignore */
        }
        if (!prompt) {
          return new Response(
            JSON.stringify({ ok: false, code: "EMPTY_PROMPT" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
          async start(controller) {
            controller.enqueue(encoder.encode(sseEvent("progress", { stage: "start" })));
            const result = await streamPromoImage(prompt);
            if (result.ok) {
              const publicUrl = await uploadPromoGeneratedImage({
                base64: result.data.base64,
                mimeType: result.data.mimeType,
              });
              const assetId = `img-${randomUUID()}`;
              if (publicUrl) {
                await cronUpsertPromoAsset({
                  id: assetId,
                  kind: "image",
                  url: publicUrl,
                  alt: prompt.slice(0, 80),
                  prompt,
                });
              }
              controller.enqueue(
                encoder.encode(
                  sseEvent("done", {
                    ok: true,
                    mimeType: result.data.mimeType,
                    base64: result.data.base64,
                    imageUrl: publicUrl ?? undefined,
                    assetId: publicUrl ? assetId : undefined,
                  }),
                ),
              );
            } else {
              controller.enqueue(
                encoder.encode(sseEvent("error", { ok: false, code: result.code })),
              );
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
