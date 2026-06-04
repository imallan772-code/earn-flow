import { createFileRoute } from "@tanstack/react-router";
import { ProfileScreen } from "@/features/profile/ProfileScreen";

export const Route = createFileRoute("/_app/my")({
  head: () => ({ meta: [{ title: "My · PHONARA" }] }),
  component: ProfileScreen,
});
