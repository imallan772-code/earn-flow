/**
 * Global multi-locale nickname pool for the live bet feed.
 * Names are masked Stake-style ("phona***", "サト***", "Алек***").
 */

const POOLS = [
  // Korean
  ["phona", "byte", "stak", "nova", "zero", "moon", "luna", "kim", "park", "lee", "choi", "yoon", "jung", "han", "cho"],
  // English / Western
  ["alpha", "neo", "shadow", "blaze", "pixel", "rogue", "echo", "vex", "lynx", "raze", "hunter", "viper", "drake", "raven"],
  // Japanese (romaji-style)
  ["sato", "yuki", "haru", "ren", "aki", "kaito", "rina", "sora", "taka", "miki"],
  // Russian (transliterated)
  ["alex", "dima", "ivan", "vlad", "maks", "sergey", "kolya", "boris"],
  // Spanish/Portuguese
  ["luis", "ana", "joao", "rafa", "diego", "paulo", "marco", "felipe"],
  // Arabic (transliterated)
  ["mohd", "ali", "omar", "khal", "yusuf", "fawaz"],
  // Chinese (pinyin-style)
  ["wei", "ming", "ling", "yang", "chen", "liu", "zhou"],
  // Vietnamese / SEA
  ["minh", "linh", "trung", "quan", "thao"],
];

const FLAT = POOLS.flat();

export function randomMaskedNick(): string {
  const stem = FLAT[Math.floor(Math.random() * FLAT.length)];
  const suffix = Math.random() < 0.6 ? "***" : "**" + Math.floor(Math.random() * 9);
  return stem + suffix;
}

/** Picks a region-mixed batch (for seeding the feed). */
export function seedNicks(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(randomMaskedNick());
  return out;
}
