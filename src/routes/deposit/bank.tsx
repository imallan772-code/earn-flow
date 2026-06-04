import { createFileRoute } from "@tanstack/react-router";
import { DepositBank } from "@/features/money-deposit/DepositBank";
export const Route = createFileRoute("/deposit/bank")({ ssr: false, head: () => ({ meta: [{ title: "계좌 입금 · PHONARA" }] }), component: DepositBank });
