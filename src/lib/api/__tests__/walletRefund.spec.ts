import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  getSupabaseClient: () => ({
    rpc: rpcMock,
  }),
}));

import { refundPhonForBet } from "../wallet";

const balanceRow = { phon: 5000, user_id: "u1", updated_at: new Date().toISOString() };

describe("refundPhonForBet", () => {
  beforeEach(() => {
    rpcMock.mockReset();
    rpcMock.mockResolvedValue({
      data: {
        balance: balanceRow,
        game: "crash",
        round_id: "n5",
        amount: 100,
        operation: "refund_phon_for_bet_v2",
        idempotent: false,
        version: 2,
      },
      error: null,
    });
  });

  it("AC-1/AC-4: calls refund_phon_for_bet_v2 with same roundId as debit (no -refund suffix)", async () => {
    await refundPhonForBet(100, "crash", "n5");

    expect(rpcMock).toHaveBeenCalledOnce();
    expect(rpcMock).toHaveBeenCalledWith("refund_phon_for_bet_v2", {
      p_amount: 100,
      p_game: "crash",
      p_round_id: "n5",
    });
  });

  it("AC-2: propagates idempotent replay from RPC", async () => {
    rpcMock.mockResolvedValue({
      data: {
        balance: balanceRow,
        game: "crash",
        round_id: "n5",
        amount: 100,
        operation: "refund_phon_for_bet_v2",
        idempotent: true,
        version: 2,
      },
      error: null,
    });

    const { data } = await refundPhonForBet(100, "crash", "n5");
    expect(data.idempotent).toBe(true);
  });

  it("rejects non-integer amount at schema boundary", async () => {
    await expect(refundPhonForBet(0.49, "crash", "n5")).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects zero amount", async () => {
    await expect(refundPhonForBet(0, "crash", "n5")).rejects.toThrow();
    expect(rpcMock).not.toHaveBeenCalled();
  });
});
