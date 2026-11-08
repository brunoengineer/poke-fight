// Stats at a level: the official formula (Gen 3+), without natures and EVs for now.

import type { BaseStats } from '../data/pokedex';

export type Stats = BaseStats;

/** Individual values (0–31) until captures roll their own (milestone 7): a middle value for everyone. */
export const DEFAULT_IV = 15;

export const uniformIvs = (iv = DEFAULT_IV): Stats => ({ hp: iv, atk: iv, def: iv, spa: iv, spd: iv, spe: iv });

export function statsAt(base: BaseStats, level: number, ivs: Stats = uniformIvs()): Stats {
  const core = (stat: keyof Stats) => Math.floor(((2 * base[stat] + ivs[stat]) * level) / 100);
  return {
    hp: core('hp') + level + 10,
    atk: core('atk') + 5,
    def: core('def') + 5,
    spa: core('spa') + 5,
    spd: core('spd') + 5,
    spe: core('spe') + 5,
  };
}

/**
 * Speed in the fight: walking, dashing and jumping a little faster or slower, from the base Speed stat (so it doesn't
 * change with level). 85% for the slowest Pokémon up to 115% for the fastest; frame data never changes.
 */
export function mobility(baseSpeed: number): number {
  return Math.round(85 + (30 * Math.min(150, Math.max(0, baseSpeed))) / 150);
}
