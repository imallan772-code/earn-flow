import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AutoBetConfigFields } from "../AutoBetConfigFields";
import type { AutoBetConfig } from "@/shared/games/engine/autoBet";

const base: AutoBetConfig = {
  strategy: "Flat",
  baseBet: 10,
  numberOfBets: 0,
  onWinIncreasePct: 0,
  onLossIncreasePct: 100,
  stopOnProfit: 0,
  stopOnLoss: 0,
};

describe("AutoBetConfigFields", () => {
  it("renders strategy select and updates on change", () => {
    const onChange = vi.fn();
    render(<AutoBetConfigFields cfg={base} onChange={onChange} />);
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "Martingale" } });
    expect(onChange).toHaveBeenCalledWith({ ...base, strategy: "Martingale" });
  });

  it("updates loss increase percent", () => {
    const onChange = vi.fn();
    render(<AutoBetConfigFields cfg={base} onChange={onChange} />);
    const inputs = screen.getAllByRole("spinbutton");
    fireEvent.change(inputs[0], { target: { value: "50" } });
    expect(onChange).toHaveBeenCalledWith({ ...base, onLossIncreasePct: 50 });
  });
});
