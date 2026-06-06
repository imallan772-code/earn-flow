import { createFileRoute } from "@tanstack/react-router";
import { FairVerifyScreen } from "@/features/fair/FairVerifyScreen";
import { verifySearchSchema } from "@/lib/pf/verifySchemas";

export const Route = createFileRoute("/fair/verify")({
  ssr: false,
  validateSearch: verifySearchSchema,
  head: () => ({
    meta: [
      { title: "PHONARA · Provably Fair 검증" },
      {
        name: "description",
        content:
          "Server seed SHA256 커밋과 client seed, nonce로 Crash·Dice·Limbo·Wheel·Mines 결과를 직접 재현하세요.",
      },
      { property: "og:title", content: "PHONARA Provably Fair Verify" },
      {
        property: "og:description",
        content: "공개 seed로 게임 결과를 독립 검증 — Stake 동일 HMAC-SHA256.",
      },
    ],
  }),
  component: FairVerifyRoute,
});

function FairVerifyRoute() {
  const search = Route.useSearch();
  return <FairVerifyScreen initial={search} />;
}
