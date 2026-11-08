// Wild encounters: the real Red/Blue tables of a city's hunting grounds. Red and Blue are merged, so both versions'
// exclusives can appear.

import { allSpecies } from '../data/pokedex';
import { RODS, type RodId } from '../data/items';
import type { City, HuntKind } from '../data/regions/kanto';
import type { Rng } from '../engine/rng';
import { createPokemon, type Pokemon } from './pokemon';
import type { Stats } from './stats';

export interface EncounterEntry {
  speciesId: number;
  minLevel: number;
  maxLevel: number;
  /** Relative weight (the games' encounter chance, summed over areas and versions). */
  weight: number;
}

/** How a hunting ground is searched: walking (grass, cave) or fishing with a rod. */
export type Method = 'walk' | RodId;

/** area → method → entries, built once from the species data. */
const INDEX = (() => {
  const index = new Map<string, Map<string, EncounterEntry[]>>();
  for (const s of allSpecies()) {
    for (const e of s.encounters) {
      const byMethod = index.get(e.area) ?? new Map<string, EncounterEntry[]>();
      index.set(e.area, byMethod);
      const list = byMethod.get(e.method) ?? [];
      byMethod.set(e.method, list);
      list.push({ speciesId: s.id, minLevel: e.minLevel, maxLevel: e.maxLevel, weight: e.chance });
    }
  }
  return index;
})();

export const hasEncounters = (area: string, method: Method) => (INDEX.get(area)?.get(method)?.length ?? 0) > 0;

/** The best rod in the bag, if any. */
export function bestRod(owned: (rod: RodId) => boolean): RodId | null {
  return [...RODS].reverse().find(owned) ?? null;
}

/** Everything that can appear when hunting this kind of ground in this city (water needs a rod). */
export function encounterTable(city: City, kind: HuntKind, rod: RodId | null): EncounterEntry[] {
  const method: Method | null = kind === 'water' ? rod : 'walk';
  if (!method) return [];
  return (city.hunts[kind] ?? []).flatMap(area => INDEX.get(area)?.get(method) ?? []);
}

export interface WildRoll {
  speciesId: number;
  level: number;
}

export function rollEncounter(table: readonly EncounterEntry[], rng: Rng): WildRoll {
  if (table.length === 0) throw new Error('Nothing lives here');
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let pick = rng.next() * total;
  const entry = table.find(e => (pick -= e.weight) < 0) ?? table[table.length - 1];
  return { speciesId: entry.speciesId, level: entry.minLevel + rng.int(entry.maxLevel - entry.minLevel + 1) };
}

/** Wild Pokémon have their own individual values (0–31 each), which they keep when caught. */
export function rollIvs(rng: Rng): Stats {
  const iv = () => rng.int(32);
  return { hp: iv(), atk: iv(), def: iv(), spa: iv(), spd: iv(), spe: iv() };
}

export function wildPokemon(roll: WildRoll, rng: Rng): Pokemon {
  return createPokemon(roll.speciesId, roll.level, { ivs: rollIvs(rng) });
}
