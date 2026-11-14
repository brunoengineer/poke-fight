// Catching (plan.md §5): after winning a wild battle, one ball. The Gen 8 formula's shape, without a performance
// bonus (decided): only the ball, the species' catch rate and the levels count.
//
//   X = WILD_SPIRIT × catchRate × ball × levelFactor
//   WILD_SPIRIT = 0.6: the HP term. A beaten wild Pokémon still has fight in it. History: the games' 1-HP value
//                 made every early Pokémon a first-try catch; 0.2 (after milestone 11) made a typical one (catch
//                 rate 45) take ~9 Great Balls, each after its own fight. 0.6 (after milestone 12).
//   ball        = Poké ×1, Great ×2, Ultra ×3.5 (decided 2026-11-14: with ×1.5 and ×2, an Ultra Ball saved under one
//                 throw over a Great Ball, at twice the price).
//   levelFactor = the wild Pokémon's level against your strongest party Pokémon's (decided 2026-11-14, replacing
//                 Gen 8's ×0.1 when it was above the one that fought, before the 8th badge: one level over cut the
//                 chance ~5.6×, and fishing in early towns fell to 4–12%). −10% per level above, down to ×0.3;
//                 +5% per level below, up to ×1.5.
//   X ≥ 255 → caught; otherwise 4 shake checks, each passing with Y / 65536, Y = 65536 / (255 / X)^(3/16)
//   (overall ≈ (X / 255)^0.75). Gen 8's "critical capture" is left out.

import type { Rng } from '../engine/rng';

export interface CatchInput {
  catchRate: number;
  /** The ball's multiplier (Infinity: the Master Ball). */
  ball: number;
  wildLevel: number;
  /** The level of the strongest Pokémon in the player's party. */
  partyLevel: number;
}

/** The HP term: how worn out a beaten wild Pokémon is (1 would be the games' 1 HP: far too easy here). */
export const WILD_SPIRIT = 0.6;

export const LEVEL_STEP_ABOVE = 0.1;
export const LEVEL_FLOOR = 0.3;
export const LEVEL_STEP_BELOW = 0.05;
export const LEVEL_CEILING = 1.5;

/** How the level gap changes the catch value: harder for each level the wild one is above, easier below. */
export function levelFactor(wildLevel: number, partyLevel: number): number {
  const gap = wildLevel - partyLevel;
  return gap > 0 ? Math.max(LEVEL_FLOOR, 1 - LEVEL_STEP_ABOVE * gap) : Math.min(LEVEL_CEILING, 1 - LEVEL_STEP_BELOW * gap);
}

export function catchValue(input: CatchInput): number {
  if (input.ball === Infinity) return Infinity;
  return WILD_SPIRIT * input.catchRate * input.ball * levelFactor(input.wildLevel, input.partyLevel);
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
