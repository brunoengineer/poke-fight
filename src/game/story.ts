// The prologue's rules: starters (each region's three, with the Professor's gift move), names, and Training opponents.

import { RODS } from '../data/items';
import { speciesBySlug } from '../data/pokedex';
import type { City, Region } from '../data/regions/types';
import type { Rng } from '../engine/rng';
import { tableForAreas, type Method } from './encounters';
import { createPokemon, type Pokemon } from './pokemon';

export const STARTER_LEVEL = 5;

/** A region's starter, with the type move its Professor teaches it (a starter's Lv. 5 learnset has none). */
export function createStarter(region: Region, id: number): Pokemon {
  const gift = region.starterGifts[id];
  return createPokemon(id, STARTER_LEVEL, { gifts: gift ? [gift] : [] });
}

/** Original default names (the player can type their own). */
export const DEFAULT_NAMES = { player: 'Kai', rival: 'Ren' };
export const MAX_NAME_LENGTH = 12;

/** Trims, collapses spaces and cuts a typed name; an empty name becomes the default. */
export function cleanName(input: string, fallback: string): string {
  const name = input.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
  return name || fallback;
}

/** How many Pokémon a Battle field trainer brings. */
export const TRAINING_TEAM = 3;

/** Every species found in this city's hunting grounds (grass, caves, water with any rod, the Safari Zone). */
export function cityPokemon(city: City): number[] {
  const walk = [...(city.hunts.grass ?? []), ...(city.hunts.cave ?? []), ...(city.hunts.rare ?? []), ...(city.safari ?? [])];
  const methods: [readonly string[], readonly Method[]][] = [
    [walk, ['walk']],
    [city.hunts.water ?? [], RODS],
  ];
  const ids = methods.flatMap(([areas, ms]) => ms.flatMap(m => tableForAreas(areas, m).map(e => e.speciesId)));
  return [...new Set(ids)].sort((a, b) => a - b);
}

/**
 * Battle field opponents (fixed after milestone 12, they were the region's same three everywhere): three different
 * Pokémon picked at random from this city's own hunting grounds, at the party's average level. A city with fewer
 * than three fills up with the region's common Pokémon.
 */
export function trainingOpponents(region: Region, city: City, party: readonly Pokemon[], rng: Rng): Pokemon[] {
  const average = Math.round(party.reduce((sum, p) => sum + p.level, 0) / party.length);
  const level = Math.min(100, Math.max(3, average));
  const pool = cityPokemon(city);
  const picked: number[] = [];
  while (picked.length < TRAINING_TEAM && pool.length > 0) picked.push(pool.splice(rng.int(pool.length), 1)[0]);
  for (const slug of region.training) {
    const id = speciesBySlug(slug).id;
    if (picked.length < TRAINING_TEAM && !picked.includes(id)) picked.push(id);
  }
  return picked.map(id => createPokemon(id, level));
}
