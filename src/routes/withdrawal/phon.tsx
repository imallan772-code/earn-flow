import { createFileRoute } from "@tanstack/react-router";
import { WithdrawalForm } from "@/features/money-withdrawal/WithdrawalForm";
export const Route = createFileRoute("/withdrawal/phon")({
  ssr: false,
  head: () => ({ meta: [{ title: "PHON 출금 · PHONARA" }] }),
  component: () => <WithdrawalForm kind="phon" />,
});
