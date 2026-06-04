import { createFileRoute } from "@tanstack/react-router";
import { ExchangePlaceholder } from "@/features/exchange/ExchangePlaceholder";

export const Route = createFileRoute("/_app/exchange/$symbol")({
  head: () => ({ meta: [{ title: "Trade · PHONARA" }] }),
  component: ExchangePlaceholder,
});
