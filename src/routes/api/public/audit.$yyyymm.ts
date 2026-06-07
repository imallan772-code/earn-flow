/**
 * GET /api/public/audit/:yyyymm — monthly PF audit JSON (GA-K).
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/audit/$yyyymm")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const month = params.yyyymm;
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return new Response("invalid month (use YYYY-MM)", { status: 400 });
        }

        const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
        const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
        if (!url || !anon) {
          return new Response("audit not configured", { status: 503 });
        }

        const res = await fetch(`${url}/rest/v1/rpc/audit_export_month_v1`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: anon,
            Authorization: `Bearer ${anon}`,
          },
          body: JSON.stringify({ p_yyyy_mm: month }),
        });

        if (!res.ok) {
          const text = await res.text();
          return new Response(text, { status: res.status });
        }

        const data = await res.json();
        return Response.json(data, {
          headers: {
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
