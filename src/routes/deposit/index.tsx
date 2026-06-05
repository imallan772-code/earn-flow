import { createFileRoute } from "@tanstack/react-router";
import { DepositHub } from "@/features/money-deposit/DepositHub";
export const Route = createFileRoute("/deposit/")({
  ssr: false,
  head: () => ({ meta: [{ title: "입금 · PHONARA" }] }),
  component: DepositHub,
});
