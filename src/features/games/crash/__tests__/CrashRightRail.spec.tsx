import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { CrashRightRail } from "../CrashRightRail";
import { liveBetsStore } from "@/shared/livefeed/LiveBetsStore";

describe("CrashRightRail", () => {
  beforeEach(() => liveBetsStore.__reset());

  it("mounts without throwing and renders the global feed header", () => {
    const { container, getByText } = render(<CrashRightRail />);
    expect(container.firstChild).toBeTruthy();
    expect(getByText("글로벌 라이브 베팅")).toBeTruthy();
  });
});
