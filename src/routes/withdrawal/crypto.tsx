import { createFileRoute } from "@tanstack/react-router";
import { WithdrawalForm } from "@/features/money-withdrawal/WithdrawalForm";
export const Route = createFileRoute("/withdrawal/crypto")({
  ssr: false,
  head: () => ({ meta: [{ title: "USDT 출금 · PHONARA" }] }),
  component: () => <WithdrawalForm kind="crypto" />,
});
