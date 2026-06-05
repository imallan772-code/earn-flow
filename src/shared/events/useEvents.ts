import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthContext";
import { getEventLeaderboard, joinEvent, listEvents, type AppEventView } from "@/lib/api/events";
import { EVENTS, type AppEvent } from "@/mocks/event";

const EVENTS_KEY = ["events"] as const;

function mockToView(e: AppEvent): AppEventView {
  return {
    id: e.id,
    status: e.status,
    title: e.title,
    tagline: e.tagline,
    body: e.body,
    rewardPreview: e.rewardPreview,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    participants: e.participants,
    cap: e.cap,
    ctaLabel: e.ctaLabel,
    terms: e.terms,
    bgFrom: e.bgFrom,
    bgTo: e.bgTo,
    progress: e.progress,
  };
}

export function useEvents() {
  const { isConfigured } = useAuth();

  const query = useQuery({
    queryKey: EVENTS_KEY,
    queryFn: listEvents,
    enabled: isConfigured,
    staleTime: 30_000,
  });

  const events: AppEventView[] =
    isConfigured && query.data && query.data.length > 0 ? query.data : EVENTS.map(mockToView);

  return {
    events,
    isLoading: isConfigured && query.isLoading,
    isLive: isConfigured && Boolean(query.data?.length),
    refetch: query.refetch,
  };
}

export function useEventDetail(eventId: string) {
  const { events, isLoading } = useEvents();

  const leaderboardQuery = useQuery({
    queryKey: ["events", eventId, "leaderboard"],
    queryFn: () => getEventLeaderboard(eventId),
    enabled: Boolean(eventId),
    staleTime: 20_000,
  });

  const event = events.find((e) => e.id === eventId) ?? null;
  const leaderboard =
    leaderboardQuery.data ??
    EVENTS.find((e) => e.id === eventId)?.leaderboard?.map((r) => ({
      rank: r.rank,
      nickname: r.nickname,
      score: r.score,
    })) ??
    [];

  return { event, leaderboard, isLoading };
}

export function useJoinEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => joinEvent(eventId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: EVENTS_KEY });
    },
  });
}

export function useActiveEvents(limit = 3) {
  const { events } = useEvents();
  return events.filter((e) => e.status === "진행중").slice(0, limit);
}
