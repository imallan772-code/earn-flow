import { createFileRoute } from "@tanstack/react-router";
import { DepositGift } from "@/features/money-deposit/DepositGift";
export const Route = createFileRoute("/deposit/gift")({
  ssr: false,
  head: () => ({ meta: [{ title: "상품권 입금 · PHONARA" }] }),
  component: DepositGift,
});
