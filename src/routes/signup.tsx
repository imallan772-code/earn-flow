import { createFileRoute } from "@tanstack/react-router";
import { AuthShell } from "@/features/auth/AuthShell";

export const Route = createFileRoute("/signup")({
  head: () => ({ meta: [{ title: "PHONARA · 가입" }, { name: "description", content: "3초 만에 가입하고 1,800 PHON 받기." }] }),
  component: () => <AuthShell mode="signup" />,
});
