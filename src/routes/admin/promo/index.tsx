import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/promo/")({
  ssr: false,
  beforeLoad: () => {
    throw redirect({ to: "/admin/promo/studio" });
  },
});
