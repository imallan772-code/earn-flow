import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { claimMissionReward, listUserMissions, recordMissionProgress } from "@/lib/api/missions";
import { MOCK_MISSIONS } from "@/mocks/missions";
import type { UserMission } from "@/lib/missions/schemas";

const MISSIONS_KEY = ["missions"] as const;

function mockToUserMission(m: (typeof MOCK_MISSIONS)[number]): UserMission {
  return {
    id: m.id,
    title: m.title,
    reward: m.reward,
    kind: m.kind,
    urgency: m.urgency,
    total: m.total ?? 1,
    progress: m.progress ?? 0,
    can_claim: false,
  };
}

export function useMissions() {
  const { status, isConfigured } = useAuth();
  const queryClient = useQueryClient();
  const enabled = isConfigured && status === "authenticated";

  const query = useQuery({
    queryKey: MISSIONS_KEY,
    queryFn: listUserMissions,
    enabled,
    staleTime: 15_000,
  });

  const claim = useMutation({
    mutationFn: (missionId: string) => claimMissionReward(missionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: MISSIONS_KEY }),
        queryClient.invalidateQueries({ queryKey: ["profile", "wallet"] }),
      ]);
    },
  });

  const record = useMutation({
    mutationFn: ({ missionId, delta }: { missionId: string; delta?: number }) =>
      recordMissionProgress(missionId, delta ?? 1),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: MISSIONS_KEY });
    },
  });

  const missions: UserMission[] = enabled
    ? (query.data ?? [])
    : MOCK_MISSIONS.map(mockToUserMission);

  return {
    missions,
    isLoading: enabled && query.isLoading,
    isLive: enabled,
    claimMission: claim.mutateAsync,
    isClaiming: claim.isPending,
    recordProgress: record.mutateAsync,
  };
}
