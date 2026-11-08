// Catching (plan.md §5): after winning a wild battle, one ball. The official Gen 8 formula, without a performance
// bonus (decided): only the ball, the species' catch rate and the levels count.
//
//   X = catchRate × ball × lowLevel × difficulty      (the HP term is fixed at 1: a defeated Pokémon is worn out)
//   lowLevel   = (30 − level) / 10 below Lv. 21
//   difficulty = 0.1 if the wild Pokémon is stronger than yours (before the 8th badge)
//   X ≥ 255 → caught; otherwise 4 shake checks, each passing with Y / 65536, Y = 65536 / (255 / X)^(3/16)
//   (overall ≈ (X / 255)^0.75). Gen 8's "critical capture" is left out.

import type { Rng } from '../engine/rng';

export interface CatchInput {
  catchRate: number;
  /** The ball's multiplier (Infinity: the Master Ball). */
  ball: number;
  wildLevel: number;
  /** The level of the player's Pokémon that won the battle. */
  playerLevel: number;
  badges: number;
}

export const lowLevelBonus = (level: number) => (level < 21 ? (30 - level) / 10 : 1);

export const DIFFICULTY_PENALTY = 410 / 4096;

export function catchValue(input: CatchInput): number {
  if (input.ball === Infinity) return Infinity;
  const difficulty = input.badges < 8 && input.wildLevel > input.playerLevel ? DIFFICULTY_PENALTY : 1;
  return input.catchRate * input.ball * lowLevelBonus(input.wildLevel) * difficulty;
}

/** The chance of passing one shake check. */
export const shakeChance = (x: number) => (x >= 255 ? 1 : Math.floor(65536 / (255 / x) ** (3 / 16)) / 65536);

/** The chance of catching (all 4 checks pass). */
export const catchChance = (x: number) => shakeChance(x) ** 4;

export interface ThrowResult {
  caught: boolean;
  /** Wobbles before breaking free (0–3), or 3 when caught. */
  shakes: number;
}

export function throwBall(x: number, rng: Rng): ThrowResult {
  if (x >= 255) return { caught: true, shakes: 3 };
  const y = Math.floor(65536 / (255 / x) ** (3 / 16));
  for (let check = 0; check < 4; check++) {
    if (rng.int(65536) >= y) return { caught: false, shakes: Math.min(check, 3) };
  }
  return { caught: true, shakes: 3 };
}
