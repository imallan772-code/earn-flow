import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/features/auth/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "PHONARA · 로그인" },
      { name: "description", content: "PHONARA에 로그인하세요." },
    ],
  }),
  component: () => <AuthShell mode="signin" />,
});
