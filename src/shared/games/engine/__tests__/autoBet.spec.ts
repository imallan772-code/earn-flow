import { describe, it, expect } from "vitest";
import { initAutoBet, step, stopManual, type AutoBetConfig } from "../autoBet";

function cfg(over: Partial<AutoBetConfig> = {}): AutoBetConfig {
  return {
    strategy: "Flat",
    baseBet: 10,
    numberOfBets: 0,
    onWinIncreasePct: 0,
    onLossIncreasePct: 0,
    stopOnProfit: 0,
    stopOnLoss: 0,
    ...over,
  };
}

describe("autoBet reducer", () => {
  describe("Martingale", () => {
    it("doubles bet exactly on each loss — 5 losses → 32× base", () => {
      let s = initAutoBet(cfg({ strategy: "Martingale", baseBet: 10 }));
      expect(s.currentBet).toBe(10);
      // loss 1 → next bet 20
      s = step(s, { outcome: "loss", delta: -10 });
      expect(s.currentBet).toBe(20);
      // loss 2 → 40
      s = step(s, { outcome: "loss", delta: -20 });
      expect(s.currentBet).toBe(40);
      // loss 3 → 80
      s = step(s, { outcome: "loss", delta: -40 });
      expect(s.currentBet).toBe(80);
      // loss 4 → 160
      s = step(s, { outcome: "loss", delta: -80 });
      expect(s.currentBet).toBe(160);
      // loss 5 → 320 (= 32× base 10)
      s = step(s, { outcome: "loss", delta: -160 });
      expect(s.currentBet).toBe(320);
    });

    it("resets to base after a win", () => {
      let s = initAutoBet(cfg({ strategy: "Martingale", baseBet: 5 }));
      s = step(s, { outcome: "loss", delta: -5 });
      s = step(s, { outcome: "loss", delta: -10 });
      expect(s.currentBet).toBe(20);
      s = step(s, { outcome: "win", delta: 20 });
      expect(s.currentBet).toBe(5);
    });
  });

  describe("AntiMartingale", () => {
    it("doubles on win, resets on loss", () => {
      let s = initAutoBet(cfg({ strategy: "AntiMartingale", baseBet: 1 }));
      s = step(s, { outcome: "win", delta: 1 });
      expect(s.currentBet).toBe(2);
      s = step(s, { outcome: "win", delta: 2 });
      expect(s.currentBet).toBe(4);
      s = step(s, { outcome: "loss", delta: -4 });
      expect(s.currentBet).toBe(1);
    });
  });

  describe("Fibonacci", () => {
    it("advances index on loss, retreats 2 on win", () => {
      let s = initAutoBet(cfg({ strategy: "Fibonacci", baseBet: 1 }));
      // start at fib[0] = 1
      expect(s.currentBet).toBe(1);
      s = step(s, { outcome: "loss", delta: -1 }); // idx 1 → 1
      expect(s.currentBet).toBe(1);
      s = step(s, { outcome: "loss", delta: -1 }); // idx 2 → 2
      expect(s.currentBet).toBe(2);
      s = step(s, { outcome: "loss", delta: -2 }); // idx 3 → 3
      expect(s.currentBet).toBe(3);
      s = step(s, { outcome: "loss", delta: -3 }); // idx 4 → 5
      expect(s.currentBet).toBe(5);
      s = step(s, { outcome: "win", delta: 5 });   // idx 2 → 2
      expect(s.currentBet).toBe(2);
    });
  });

  describe("DAlembert", () => {
    it("adds base on loss, subtracts base on win, floors at base", () => {
      let s = initAutoBet(cfg({ strategy: "DAlembert", baseBet: 10 }));
      s = step(s, { outcome: "loss", delta: -10 });
      expect(s.currentBet).toBe(20);
      s = step(s, { outcome: "loss", delta: -20 });
      expect(s.currentBet).toBe(30);
      s = step(s, { outcome: "win", delta: 30 });
      expect(s.currentBet).toBe(20);
      s = step(s, { outcome: "win", delta: 20 });
      expect(s.currentBet).toBe(10);
      s = step(s, { outcome: "win", delta: 10 });
      expect(s.currentBet).toBe(10); // floored at base
    });
  });

  describe("stop conditions", () => {
    it("stops after numberOfBets", () => {
      let s = initAutoBet(cfg({ numberOfBets: 3 }));
      s = step(s, { outcome: "win", delta: 10 });
      s = step(s, { outcome: "win", delta: 10 });
      expect(s.running).toBe(true);
      s = step(s, { outcome: "win", delta: 10 });
      expect(s.running).toBe(false);
      expect(s.stopReason).toBe("count");
    });

    it("stops on profit threshold", () => {
      let s = initAutoBet(cfg({ stopOnProfit: 25 }));
      s = step(s, { outcome: "win", delta: 10 });
      s = step(s, { outcome: "win", delta: 10 });
      expect(s.running).toBe(true);
      s = step(s, { outcome: "win", delta: 10 });
      expect(s.running).toBe(false);
      expect(s.stopReason).toBe("profit");
      expect(s.pnl).toBe(30);
    });

    it("stops on loss threshold", () => {
      let s = initAutoBet(cfg({ stopOnLoss: 25 }));
      s = step(s, { outcome: "loss", delta: -10 });
      s = step(s, { outcome: "loss", delta: -10 });
      expect(s.running).toBe(true);
      s = step(s, { outcome: "loss", delta: -10 });
      expect(s.running).toBe(false);
      expect(s.stopReason).toBe("loss");
    });

    it("stopManual halts the run", () => {
      let s = initAutoBet(cfg());
      s = stopManual(s);
      expect(s.running).toBe(false);
      expect(s.stopReason).toBe("manual");
      const after = step(s, { outcome: "win", delta: 10 });
      // step is a no-op once stopped
      expect(after).toBe(s);
    });
  });

  describe("onWin / onLoss percent modifiers", () => {
    it("Flat + onLossIncreasePct=50 grows bet 1.5× per loss", () => {
      let s = initAutoBet(cfg({ strategy: "Flat", baseBet: 10, onLossIncreasePct: 50 }));
      s = step(s, { outcome: "loss", delta: -10 });
      expect(s.currentBet).toBeCloseTo(15, 10);
      s = step(s, { outcome: "loss", delta: -15 });
      expect(s.currentBet).toBeCloseTo(22.5, 10);
    });
  });
});
