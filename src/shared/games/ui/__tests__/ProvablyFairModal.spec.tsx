import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProvablyFairModal } from "../ProvablyFairModal";

describe("ProvablyFairModal", () => {
  it("renders rows when open", () => {
    render(
      <ProvablyFairModal
        open
        onClose={vi.fn()}
        rows={[{ label: "nonce", content: <code>42</code> }]}
      />,
    );
    screen.getByText("nonce");
    screen.getByText("42");
  });

  it("calls onClose on Escape", () => {
    const onClose = vi.fn();
    render(<ProvablyFairModal open onClose={onClose} rows={[]} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("returns null when closed", () => {
    const { container } = render(<ProvablyFairModal open={false} onClose={vi.fn()} rows={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
