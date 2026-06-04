export type GameSlug = "crash" | "rps" | "slots" | "lucky-box" | "roulette" | "card-flip";

export interface GameMeta {
  slug: GameSlug;
  title: string;
  tagline: string;
  accent: "cyan" | "purple" | "pink" | "gold" | "emerald" | "rose";
  liveCount: number;
}

export const MOCK_GAMES: GameMeta[] = [
  { slug: "crash", title: "크래시", tagline: "타이밍이 곧 돈", accent: "cyan", liveCount: 12_482 },
  { slug: "rps", title: "가위바위보", tagline: "3초 한판", accent: "pink", liveCount: 8_204 },
  { slug: "slots", title: "슬롯", tagline: "잭팟 폭주", accent: "gold", liveCount: 21_938 },
  { slug: "lucky-box", title: "럭키 박스", tagline: "오늘의 행운", accent: "purple", liveCount: 7_412 },
  { slug: "roulette", title: "룰렛", tagline: "35배 적중 가능", accent: "rose", liveCount: 5_320 },
  { slug: "card-flip", title: "카드 뒤집기", tagline: "메모리 연승", accent: "emerald", liveCount: 3_140 },
];

export const MOCK_BET_HISTORY = [
  { id: "b1", label: "2.4×", win: true },
  { id: "b2", label: "1.0×", win: false },
  { id: "b3", label: "7.8×", win: true },
  { id: "b4", label: "0×", win: false },
  { id: "b5", label: "12.0×", win: true },
  { id: "b6", label: "1.4×", win: true },
];
