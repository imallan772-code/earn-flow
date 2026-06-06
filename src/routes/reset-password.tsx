import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordScreen } from "@/features/auth/ResetPasswordScreen";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PHONARA · 비밀번호 재설정" },
      { name: "description", content: "새 비밀번호를 설정하세요." },
    ],
  }),
  component: ResetPasswordScreen,
});
