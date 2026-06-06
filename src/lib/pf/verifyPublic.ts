/**
 * Public PF verify — re-derive round outcomes from revealed seeds (Stake 1:1).
 */
import { computeCrashPoint } from "@/shared/games/crash/CrashEngine";
import { computeRoll } from "@/shared/games/dice/DiceEngine";
import {
  commitServerSeed,
  verifyRevealedSeed,
  type ProvablyFairInput,
} from "@/shared/games/engine/provablyFair";
import { computeCrashPoint as computeLimboPoint } from "@/shared/games/limbo/LimboEngine";
import { placeMines } from "@/shared/games/mines/MinesEngine";
import {
  getSegments,
  spin,
  type WheelRisk,
  type WheelSegments,
} from "@/shared/games/wheel/WheelEngine";
import { verifyInputSchema, type VerifyGame, type VerifyInput } from "./verifySchemas";

const WHEEL_SEGMENTS = [10, 20, 30] as const;

function parseWheelSegments(value: number | undefined): WheelSegments | undefined {
  if (value === undefined) return undefined;
  return WHEEL_SEGMENTS.includes(value as WheelSegments) ? (value as WheelSegments) : undefined;
}

export interface VerifyOutcome {
  commitHash: string;
  commitValid: boolean | null;
  label: string;
  detail: string;
  raw: Record<string, unknown>;
}

function pfInput(input: VerifyInput): ProvablyFairInput {
  return {
    serverSeed: input.serverSeed,
    clientSeed: input.clientSeed,
    nonce: input.nonce,
  };
}

function requireWheel(input: VerifyInput): { risk: WheelRisk; segments: WheelSegments } {
  const segments = parseWheelSegments(input.segments);
  if (!input.risk || segments === undefined) {
    throw new Error("wheel verify requires risk and segments");
  }
  return { risk: input.risk, segments };
}

function requireMines(input: VerifyInput): number {
  if (input.mineCount === undefined) {
    throw new Error("mines verify requires mineCount");
  }
  return input.mineCount;
}

/** Build shareable verify URL (query prefill). */
export function buildVerifyShareUrl(origin: string, input: VerifyInput): string {
  const parsed = verifyInputSchema.parse(input);
  const params = new URLSearchParams({
    game: parsed.game,
    serverSeed: parsed.serverSeed,
    clientSeed: parsed.clientSeed,
    nonce: String(parsed.nonce),
  });
  if (parsed.serverSeedHash) params.set("hash", parsed.serverSeedHash);
  if (parsed.mineCount !== undefined) params.set("mineCount", String(parsed.mineCount));
  const wheelSegments = parseWheelSegments(parsed.segments);
  if (wheelSegments !== undefined) params.set("segments", String(wheelSegments));
  if (parsed.risk) params.set("risk", parsed.risk);
  return `${origin}/fair/verify?${params.toString()}`;
}

export async function verifyProvablyFair(input: VerifyInput): Promise<VerifyOutcome> {
  const parsed = verifyInputSchema.parse(input);
  const seeds = pfInput(parsed);
  const commitHash = await commitServerSeed(seeds.serverSeed);

  let commitValid: boolean | null = null;
  if (parsed.serverSeedHash) {
    commitValid = await verifyRevealedSeed(seeds.serverSeed, parsed.serverSeedHash);
  }

  switch (parsed.game) {
    case "crash": {
      const crashPoint = await computeCrashPoint(seeds);
      return {
        commitHash,
        commitValid,
        label: "Crash point",
        detail: `${crashPoint.toFixed(2)}×`,
        raw: { crashPoint },
      };
    }
    case "limbo": {
      const target = await computeLimboPoint(seeds);
      return {
        commitHash,
        commitValid,
        label: "Limbo result",
        detail: `${target.toFixed(2)}×`,
        raw: { resultMultiplier: target },
      };
    }
    case "dice": {
      const roll = await computeRoll(seeds);
      return {
        commitHash,
        commitValid,
        label: "Dice roll",
        detail: roll.toFixed(2),
        raw: { roll },
      };
    }
    case "wheel": {
      const { risk, segments } = requireWheel(parsed);
      const index = await spin(seeds, segments);
      const table = getSegments(risk, segments);
      const multiplier = table[index] ?? 0;
      return {
        commitHash,
        commitValid,
        label: "Wheel segment",
        detail: `${multiplier}× (index ${index})`,
        raw: { index, multiplier, risk, segments },
      };
    }
    case "mines": {
      const mineCount = requireMines(parsed);
      const mines = await placeMines(seeds, mineCount);
      return {
        commitHash,
        commitValid,
        label: "Mine tiles",
        detail: mines.join(", "),
        raw: { mines, mineCount },
      };
    }
    default: {
      const _exhaustive: never = parsed.game;
      throw new Error(`unsupported game: ${_exhaustive satisfies VerifyGame}`);
    }
  }
}
