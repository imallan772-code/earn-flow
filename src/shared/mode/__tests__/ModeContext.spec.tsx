import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { ModeProvider, useMode } from "../ModeContext";

vi.mock("@/features/auth/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    status: "unauthenticated",
    isConfigured: true,
  }),
}));

vi.mock("@/lib/api/userSettings", () => ({
  preferredModeErrorMessage: () => "모드를 변경할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  resolveUserMode: vi.fn(),
  setPreferredMode: vi.fn(),
}));

vi.mock("@/shared/ui/toast", () => ({
  appToast: { raw: { error: vi.fn() } },
}));

function wrapper({ children }: { children: ReactNode }) {
  return <ModeProvider>{children}</ModeProvider>;
}

describe("ModeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("forces unauthenticated Supabase users to demo even if guest storage says real", async () => {
    window.localStorage.setItem("phonara.mode.guest", "real");

    const { result } = renderHook(() => useMode(), { wrapper });

    await waitFor(() => expect(result.current.modeReady).toBe(true));
    expect(result.current.mode).toBe("demo");
    expect(window.localStorage.getItem("phonara.mode.guest")).toBe("demo");
  });
});
