import { describe, it, expect, beforeEach } from "vitest";
import { playSfx, setSfxEnabled, __resetSfxEngineForTests } from "../SfxEngine";
import { sfxStore } from "@/shared/games/state/persistedGameState";

describe("SfxEngine", () => {
  beforeEach(() => {
    __resetSfxEngineForTests();
    sfxStore.set({ enabled: true, volume: 0.7 });
  });

  it("does not throw when muted", () => {
    setSfxEnabled(false);
    expect(() => playSfx("bet")).not.toThrow();
    expect(() => playSfx("win")).not.toThrow();
  });

  it("plays deterministically without audio context in jsdom", () => {
    expect(() => {
      playSfx("tick");
      playSfx("loss");
      playSfx("jackpot");
    }).not.toThrow();
  });

  it("stores volume in sfxStore", () => {
    sfxStore.set({ enabled: true, volume: 0.25 });
    expect(sfxStore.get().volume).toBe(0.25);
  });
});
