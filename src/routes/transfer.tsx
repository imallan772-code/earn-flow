import { createFileRoute } from "@tanstack/react-router";
import { TransferBridge } from "@/features/money-transfer/TransferBridge";
export const Route = createFileRoute("/transfer")({
  ssr: false,
  head: () => ({ meta: [{ title: "전송 · PHONARA" }] }),
  component: TransferBridge,
});
