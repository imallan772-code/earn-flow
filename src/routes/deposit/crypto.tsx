import { createFileRoute } from "@tanstack/react-router";
import { DepositCrypto } from "@/features/money-deposit/DepositCrypto";
export const Route = createFileRoute("/deposit/crypto")({ ssr: false, head: () => ({ meta: [{ title: "USDT 입금 · PHONARA" }] }), component: DepositCrypto });
