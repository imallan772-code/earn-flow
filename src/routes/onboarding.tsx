import { createFileRoute } from "@tanstack/react-router";
import { Onboarding } from "@/features/onboarding/Onboarding";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  head: () => ({ meta: [{ title: "PHONARA · 시작하기" }] }),
  component: Onboarding,
});
