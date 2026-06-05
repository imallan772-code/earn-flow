import type { LucideIcon } from "lucide-react";
import {
  Rocket,
  Dices,
  Cherry,
  CircleDot,
  Hand,
  Gift,
  Layers,
  Trophy,
  Coins,
  Bomb,
} from "lucide-react";
import { MOCK_GAME_LIVE_BETS } from "@/mocks/gameLobby";
import {
  CRASH_RULES,
  DICE_RULES,
  PLINKO_RULES,
  MINES_RULES,
  type GameRules,
} from "@/shared/games/rules/gameRules";

export type GameId =
  | "crash"
  | "dice"
  | "plinko"
  | "mines"
  | "slots"
  | "roulette"
  | "rps"
  | "luckybox"
  | "cardflip"
  | "keepy";

export type GameAccent = "cyan" | "gold" | "emerald" | "purple" | "pink" | "warning";

export interface GameRegistryEntry {
  id: GameId;
  name: string;
  rtp: string;
  liveBets: number;
  Icon: LucideIcon;
  open: boolean;
  accent: GameAccent;
  route: `/_app/games/${GameId}` | null;
  rules: GameRules | null;
}

export const GAME_REGISTRY: GameRegistryEntry[] = [
  {
    id: "crash",
    name: "Crash",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.crash,
    Icon: Rocket,
    open: true,
    accent: "cyan",
    route: "/_app/games/crash",
    rules: CRASH_RULES,
  },
  {
    id: "dice",
    name: "Dice",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.dice,
    Icon: Dices,
    open: true,
    accent: "emerald",
    route: "/_app/games/dice",
    rules: DICE_RULES,
  },
  {
    id: "plinko",
    name: "Plinko",
    rtp: "97%",
    liveBets: MOCK_GAME_LIVE_BETS.plinko,
    Icon: Coins,
    open: true,
    accent: "purple",
    route: "/_app/games/plinko",
    rules: PLINKO_RULES,
  },
  {
    id: "mines",
    name: "Mines",
    rtp: "99%",
    liveBets: MOCK_GAME_LIVE_BETS.mines,
    Icon: Bomb,
    open: true,
    accent: "warning",
    route: "/_app/games/mines",
    rules: MINES_RULES,
  },
  {
    id: "slots",
    name: "Slots",
    rtp: "96%",
    liveBets: MOCK_GAME_LIVE_BETS.slots,
    Icon: Cherry,
    open: false,
    accent: "pink",
    route: null,
    rules: null,
  },
  {
    id: "roulette",
    name: "Roulette",
    rtp: "97.3%",
    liveBets: MOCK_GAME_LIVE_BETS.roulette,
    Icon: CircleDot,
    open: false,
    accent: "warning",
    route: null,
    rules: null,
  },
  {
    id: "rps",
    name: "RPS",
    rtp: "98%",
    liveBets: MOCK_GAME_LIVE_BETS.rps,
    Icon: Hand,
    open: false,
    accent: "purple",
    route: null,
    rules: null,
  },
  {
    id: "luckybox",
    name: "LuckyBox",
    rtp: "95%",
    liveBets: MOCK_GAME_LIVE_BETS.luckybox,
    Icon: Gift,
    open: false,
    accent: "gold",
    route: null,
    rules: null,
  },
  {
    id: "cardflip",
    name: "CardFlip",
    rtp: "98%",
    liveBets: MOCK_GAME_LIVE_BETS.cardflip,
    Icon: Layers,
    open: false,
    accent: "cyan",
    route: null,
    rules: null,
  },
  {
    id: "keepy",
    name: "Keepy-Uppy",
    rtp: "—",
    liveBets: MOCK_GAME_LIVE_BETS.keepy,
    Icon: Trophy,
    open: false,
    accent: "emerald",
    route: null,
    rules: null,
  },
];

export const OPEN_GAMES = GAME_REGISTRY.filter((g) => g.open);

export function getGameById(id: GameId): GameRegistryEntry | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}

export type OpenGamePath = "/games/crash" | "/games/dice" | "/games/plinko" | "/games/mines";

/** Public route path for TanStack Router Link `to` prop (open games only). */
export function gamePath(id: GameId): OpenGamePath | null {
  const entry = getGameById(id);
  if (!entry?.open || !entry.route) return null;
  return `/games/${id}` as OpenGamePath;
}
