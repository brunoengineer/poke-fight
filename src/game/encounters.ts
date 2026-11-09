// Wild encounters: the real Red/Blue tables of a city's hunting grounds. Red and Blue are merged, so both versions'
// exclusives can appear.

import { wildEncounters } from '../data/pokedex';
import { RODS, type RodId } from '../data/items';
import { regionOf, type City, type HuntKind } from '../data/regions';
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

/**
 * area → method → entries, built once from every region's tables (Kanto: its species' Red/Blue encounters; later
 * regions: their own games' tables, which also have older species, like Pidgey on Johto's routes).
 */
const INDEX = (() => {
  const index = new Map<string, Map<string, EncounterEntry[]>>();
  for (const e of wildEncounters()) {
    const byMethod = index.get(e.area) ?? new Map<string, EncounterEntry[]>();
    index.set(e.area, byMethod);
    const list = byMethod.get(e.method) ?? [];
    byMethod.set(e.method, list);
    list.push({ speciesId: e.speciesId, minLevel: e.minLevel, maxLevel: e.maxLevel, weight: e.chance });
  }
  return index;
})();

export const hasEncounters = (area: string, method: Method) => (INDEX.get(area)?.get(method)?.length ?? 0) > 0;

/** The best rod in the bag, if any. */
export function bestRod(owned: (rod: RodId) => boolean): RodId | null {
  return [...RODS].reverse().find(owned) ?? null;
}

/** Everything found in these areas with this method. */
export const tableForAreas = (areas: readonly string[], method: Method): EncounterEntry[] =>
  areas.flatMap(area => INDEX.get(area)?.get(method) ?? []);

/**
 * How often a rod hooks what the better rods catch here (decided after milestone 11): in Red/Blue the Old Rod only
 * ever catches Magikarp, and the Good Rod the same Poliwag and Goldeen in every town, which makes fishing dull. Here
 * each rod also hooks, now and then, the better rods' Pokémon of that water (so each town's fishing has its own
 * locals), at its own (lower) levels. The Super Rod is the best: nothing above it.
 */
export const RARE_BITE = 0.3;

/** Everything that can appear when hunting this kind of ground in this city (water needs a rod). */
export function encounterTable(city: City, kind: HuntKind, rod: RodId | null): EncounterEntry[] {
  const method: Method | null = kind === 'water' ? rod : 'walk';
  if (!method) return [];
  const areas = city.hunts[kind] ?? [];
  const table = tableForAreas(areas, method);
  if (method === 'walk') return table;
  const better = RODS.slice(RODS.indexOf(method) + 1).flatMap(r => tableForAreas(areas, r));
  return withRareBites(table, better);
}

/** The rod's own table, plus the better rods' Pokémon as RARE_BITE of the weight, at this rod's levels. */
function withRareBites(own: EncounterEntry[], better: EncounterEntry[]): EncounterEntry[] {
  const extra = better.filter(b => !own.some(o => o.speciesId === b.speciesId));
  if (own.length === 0 || extra.length === 0) return own;
  const ownWeight = own.reduce((sum, e) => sum + e.weight, 0);
  const extraWeight = extra.reduce((sum, e) => sum + e.weight, 0);
  const scale = (ownWeight * RARE_BITE) / (1 - RARE_BITE) / extraWeight;
  const minLevel = Math.min(...own.map(e => e.minLevel));
  const maxLevel = Math.max(...own.map(e => e.maxLevel));
  return [...own, ...extra.map(e => ({ speciesId: e.speciesId, minLevel, maxLevel: maxLevel + 2, weight: e.weight * scale }))];
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

// ── Variety: what you actually meet ─────────────────────────────────────────────────────────────────────────────────
// The Red/Blue tables put Pidgey, Rattata and Spearow on nearly every route, and make a city's own Pokémon rare (a
// Vulpix 1 time in 30). Decided after milestone 11, so each new city feels new:
//   - rates are flattened (the square root of each species' share): rare ones stay rarer, but not 1 in 30;
//   - a species that already lived in an earlier city (story order) is an "old face": a quarter as often;
//   - a species the player hasn't caught yet comes twice as often.
// The levels stay the games'.

/** The rates' exponent (0.5: the square root). */
export const FLATTEN = 0.5;
/** A species already met in an earlier city appears this much as often. */
export const OLD_FACE = 0.25;
/** A species not caught yet appears this much more often. */
export const FRESH = 2;

/** Every species in a city's hunting grounds (every kind, every rod, the Safari Zone). */
function citySpecies(city: City): number[] {
  const kinds: HuntKind[] = ['grass', 'cave'];
  const tables = [
    ...kinds.flatMap(kind => encounterTable(city, kind, null)),
    ...RODS.flatMap(rod => encounterTable(city, 'water', rod)),
    ...tableForAreas(city.safari ?? [], 'walk'),
  ];
  return [...new Set(tables.map(e => e.speciesId))];
}

const OLD_FACES = new Map<string, Set<number>>();

/** The species that already lived in a city before this one, in its region's story order. */
export function oldFaces(cityId: string): Set<number> {
  let faces = OLD_FACES.get(cityId);
  if (!faces) {
    const cities = regionOf(cityId).cities;
    faces = new Set(cities.slice(0, Math.max(0, cities.findIndex(c => c.id === cityId))).flatMap(citySpecies));
    OLD_FACES.set(cityId, faces);
  }
  return faces;
}

/**
 * What you meet hunting here: one entry per species (with its level range), weighted for variety (see above). The
 * raw tables (encounterTable) stay the games'; the Pokédex shows those.
 */
export function huntTable(city: City, raw: readonly EncounterEntry[], caught: readonly number[]): EncounterEntry[] {
  const total = raw.reduce((sum, e) => sum + e.weight, 0);
  if (total === 0) return [];
  const old = oldFaces(city.id);
  const bySpecies = new Map<number, EncounterEntry>();
  for (const e of raw) {
    const entry = bySpecies.get(e.speciesId) ?? { speciesId: e.speciesId, minLevel: e.minLevel, maxLevel: e.maxLevel, weight: 0 };
    entry.minLevel = Math.min(entry.minLevel, e.minLevel);
    entry.maxLevel = Math.max(entry.maxLevel, e.maxLevel);
    entry.weight += e.weight / total;
    bySpecies.set(e.speciesId, entry);
  }
  return [...bySpecies.values()].map(e => ({
    ...e,
    weight: e.weight ** FLATTEN * (old.has(e.speciesId) ? OLD_FACE : 1) * (caught.includes(e.speciesId) ? 1 : FRESH),
  }));
}

/** Each species' chance in a table (0–1), most likely first. */
export function chances(table: readonly EncounterEntry[]): { speciesId: number; chance: number }[] {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  const by = new Map<number, number>();
  for (const e of table) by.set(e.speciesId, (by.get(e.speciesId) ?? 0) + e.weight / total);
  return [...by.entries()].map(([speciesId, chance]) => ({ speciesId, chance })).sort((a, b) => b.chance - a.chance);
}
