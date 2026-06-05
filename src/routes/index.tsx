import { createFileRoute } from "@tanstack/react-router";
import { Landing } from "@/features/landing/Landing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PHONARA — 1,012만+ 명이 매일 돈 버는 곳" },
      {
        name: "description",
        content: "한국 1,012만+ 명의 무료 부수입 플랫폼. 오늘만 150% 보너스.",
      },
    ],
  }),
  component: Landing,
});
