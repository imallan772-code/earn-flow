import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { LazyMotion, domAnimation } from "framer-motion";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-cosmic px-4">
      <div className="glass-3 max-w-sm rounded-3xl p-8 text-center shadow-depth-3">
        <h1 className="text-holographic text-6xl font-extrabold">404</h1>
        <h2 className="mt-3 text-lg font-semibold">길을 잃었어요</h2>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">
          요청하신 페이지를 찾을 수 없어요. 처음 화면으로 돌아가서 다시 시작해 주세요.
        </p>
        <Link
          to="/"
          className="mt-5 inline-flex h-10 items-center justify-center rounded-2xl bg-holographic px-5 text-sm font-semibold text-[var(--color-bg-0)] shadow-glow-purple"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cosmic px-4">
      <div className="glass-3 max-w-sm rounded-3xl p-8 text-center shadow-depth-3">
        <h1 className="text-lg font-semibold">잠시 문제가 생겼어요</h1>
        <p className="mt-1.5 text-sm text-[var(--color-muted)]">다시 시도하거나 홈으로 돌아가 주세요.</p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex h-10 items-center justify-center rounded-2xl bg-holographic px-4 text-sm font-semibold text-[var(--color-bg-0)]"
          >
            다시 시도
          </button>
          <a href="/" className="glass-2 inline-flex h-10 items-center justify-center rounded-2xl px-4 text-sm">
            홈으로
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0d0a1a" },
      { title: "PHONARA — 1,012만+ 명이 매일 돈 버는 곳" },
      { name: "description", content: "한국 1,012만+ 명이 매일 접속하는 무료 부수입 플랫폼. 출석만 해도 PHON 지급, 오늘 300% 보너스 이벤트." },
      { property: "og:title", content: "PHONARA — 매일 도파민 부수입" },
      { property: "og:description", content: "출석·미션·게임으로 PHON을 모아 KRW/USDT로 인출하세요." },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "preconnect", href: "https://cdn.jsdelivr.net", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={domAnimation} strict>
        <Outlet />
        <Toaster
          position="top-center"
          theme="dark"
          toastOptions={{
            style: {
              background: "color-mix(in oklab, oklch(0.24 0.05 282) 90%, transparent)",
              border: "1px solid oklch(1 0 0 / 0.12)",
              color: "oklch(0.98 0.01 280)",
              backdropFilter: "blur(14px)",
            },
          }}
        />
      </LazyMotion>
    </QueryClientProvider>
  );
}
