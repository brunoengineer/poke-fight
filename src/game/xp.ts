// Experience: the official growth curves (how much total XP each level needs) and the XP a defeated Pokémon gives.

export const MAX_LEVEL = 100;

/** Total XP needed to reach a level, for each growth rate (PokeAPI's names). */
const CURVES: Record<string, (n: number) => number> = {
  fast: n => (4 * n ** 3) / 5,
  medium: n => n ** 3, // "medium fast" in the games
  'medium-slow': n => (6 * n ** 3) / 5 - 15 * n ** 2 + 100 * n - 140,
  slow: n => (5 * n ** 3) / 4,
  // Erratic.
  'slow-then-very-fast': n =>
    n <= 50
      ? (n ** 3 * (100 - n)) / 50
      : n <= 68
        ? (n ** 3 * (150 - n)) / 100
        : n <= 98
          ? (n ** 3 * Math.floor((1911 - 10 * n) / 3)) / 500
          : (n ** 3 * (160 - n)) / 100,
  // Fluctuating.
  'fast-then-very-slow': n =>
    n <= 15 ? (n ** 3 * (Math.floor((n + 1) / 3) + 24)) / 50 : n <= 36 ? (n ** 3 * (n + 14)) / 50 : (n ** 3 * (Math.floor(n / 2) + 32)) / 50,
};

export function xpForLevel(growthRate: string, level: number): number {
  const curve = CURVES[growthRate];
  if (!curve) throw new Error(`Unknown growth rate ${growthRate}`);
  if (level <= 1) return 0;
  return Math.max(0, Math.floor(curve(level)));
}

/** The level a total amount of XP reaches. */
export function levelForXp(growthRate: string, xp: number): number {
  let level = 1;
  while (level < MAX_LEVEL && xpForLevel(growthRate, level + 1) <= xp) level++;
  return level;
}

/** Trainers' Pokémon give 1.5× XP. */
export const TRAINER_BONUS = 1.5;

/**
 * XP for defeating a Pokémon (Gen 1–4 formula): base experience × level / 7, ×1.5 from a trainer, split equally among
 * the Pokémon that fought it.
 */
export function xpForDefeating(baseExperience: number, level: number, trainer: boolean, sharedBy = 1): number {
  const total = (baseExperience * level) / 7;
  return Math.max(1, Math.floor(((trainer ? TRAINER_BONUS : 1) * total) / Math.max(1, sharedBy)));
}
