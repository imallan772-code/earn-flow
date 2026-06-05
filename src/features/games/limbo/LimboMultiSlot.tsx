/**
 * LimboMultiSlot — manual×2 slots + active-slot full auto panel.
 * Each slot = LimboDisplay + StakeBetPanel(compact for inactive, full+key remount for active).
 * Active slot toggle = panel remount → auto auto-stops on switch.
 */
import { memo } from "react";
import { StakeBetPanel } from "@/shared/games/ui/StakeBetPanel";
import type { LimboOutcome } from "@/shared/games/state/persistedGameState";
import { LimboDisplay } from "./LimboDisplay";

interface SlotState {
  slot: 0 | 1;
  phase: "idle" | "rolling" | "settled";
  resultCrash: number | null;
  /** active 라운드가 있으면 그 target, 없으면 store target. */
  displayTarget: number;
  won: boolean | null;
  isIdle: boolean;
  hasActiveBet: boolean;
  lastOutcome: LimboOutcome | null;
  bettingRoundKey: number;
}

interface Props {
  slots: [SlotState, SlotState];
  activeSlot: 0 | 1;
  balance: number;
  onActivate: (slot: 0 | 1) => void;
  onPlace: (slot: 0 | 1, amount: number) => void;
}

export const LimboMultiSlot = memo(function LimboMultiSlot({
  slots,
  activeSlot,
  balance,
  onActivate,
  onPlace,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
      {slots.map((s) => {
        const isActive = s.slot === activeSlot;
        const lastOutcome = s.lastOutcome
          ? {
              outcome: s.lastOutcome.outcome,
              profit: s.lastOutcome.profit,
              nonce: s.lastOutcome.nonce,
            }
          : null;
        return (
          <div key={s.slot} className="flex flex-col gap-2">
            <LimboDisplay
              slot={s.slot}
              phase={s.phase}
              resultCrash={s.resultCrash}
              target={s.displayTarget}
              won={s.won}
              active={isActive}
              onActivate={() => onActivate(s.slot)}
            />
            <StakeBetPanel
              key={isActive ? `active-${activeSlot}` : `slot-${s.slot}-inactive`}
              variant={isActive ? "full" : "compact"}
              showAutoTarget={false}
              canPlace={s.isIdle}
              hasActiveBet={s.hasActiveBet}
              balance={balance}
              lastOutcome={lastOutcome}
              bettingRoundKey={isActive ? s.bettingRoundKey : undefined}
              onPlace={(amount) => onPlace(s.slot, amount)}
              onCashout={() => {
                /* single-step: cashout not used */
              }}
            />
          </div>
        );
      })}
    </div>
  );
});
