import { useQuery } from "@tanstack/react-query";
import { isSupabaseConfigured } from "@/integrations/supabase/env";
import { listNotices, type NoticeView } from "@/lib/api/notices";
import { NOTICES, type Notice } from "@/mocks/notice";

const NOTICES_KEY = ["notices"] as const;

function mockToView(n: Notice): NoticeView {
  return {
    id: n.id,
    category: n.category,
    title: n.title,
    excerpt: n.excerpt,
    body: n.body,
    pinned: n.pinned,
    publishedAt: n.publishedAt,
    author: n.author,
  };
}

export function useNotices() {
  const isConfigured = isSupabaseConfigured();
  const query = useQuery({
    queryKey: NOTICES_KEY,
    queryFn: listNotices,
    enabled: isConfigured,
    staleTime: 60_000,
  });

  const notices: NoticeView[] =
    isConfigured && query.data && query.data.length > 0 ? query.data : NOTICES.map(mockToView);

  return {
    notices,
    isLoading: isConfigured && query.isLoading,
    error: query.error,
  };
}

export function useNoticeDetail(noticeId: string) {
  const { notices, isLoading } = useNotices();
  return {
    notice: notices.find((n) => n.id === noticeId) ?? null,
    isLoading,
  };
}
