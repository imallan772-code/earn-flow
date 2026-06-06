import { createFileRoute } from "@tanstack/react-router";
import { AuthCallbackScreen } from "@/features/auth/AuthCallbackScreen";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [{ title: "PHONARA · 로그인 연결 중" }],
  }),
  component: AuthCallbackScreen,
});
