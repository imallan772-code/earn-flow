import { createFileRoute } from "@tanstack/react-router";
import { WithdrawalHub } from "@/features/money-withdrawal/WithdrawalHub";
export const Route = createFileRoute("/withdrawal/")({ ssr: false, head: () => ({ meta: [{ title: "출금 · PHONARA" }] }), component: WithdrawalHub });
