// The Pokédex's rules: what the player knows about each species (unseen, seen, caught), how many they own now, how
// a species evolves in this game, and where in Kanto it lives. Pure: the screen (ui/screens/pokedex.ts) only shows it.

import { EVOLUTION_ITEMS, RODS, type EvolutionItemId, type RodId } from '../data/items';
import { allSpecies, hasSpecies, species, type Evolution } from '../data/pokedex';
import type { HuntKind, Region } from '../data/regions';
import { encounterTable, tableForAreas } from './encounters';
import type { Pokemon } from './pokemon';

export type DexStatus = 'unseen' | 'seen' | 'caught';

export interface DexRecord {
  seen: readonly number[];
  caught: readonly number[];
}

/** A region's Pokédex, in order: every species up to its last (each region's Pokédex includes the earlier ones). */
export const dexNumbers = (last: number): number[] => allSpecies().map(s => s.id).filter(id => id <= last).sort((a, b) => a - b);

export function dexStatus(dex: DexRecord, id: number): DexStatus {
  if (dex.caught.includes(id)) return 'caught';
  return dex.seen.includes(id) ? 'seen' : 'unseen';
}

/** How many of this species the player has now (party and box): a released Pokémon stays "caught" in the Pokédex. */
export const ownedCount = (team: { party: readonly Pokemon[]; box: readonly Pokemon[] }, id: number) =>
  [...team.party, ...team.box].filter(p => p.speciesId === id).length;

/** How an evolution happens in this game: a level, a stone, or the Link Cable (trading, decided). */
export type EvolveBy = { kind: 'level'; level: number } | { kind: 'item'; item: EvolutionItemId };

/**
 * The evolutions this game supports (into species it has): by level, by a stone sold in shops, by trading (any trade,
 * holding an item or not: the Link Cable) or by friendship (the Soothe Bell). The rest ("other") can't happen.
 */
export function evolveBy(e: Evolution): EvolveBy | null {
  if (!hasSpecies(e.to)) return null;
  if (e.kind === 'level') return { kind: 'level', level: e.level };
  if (e.kind === 'item') {
    const item = e.item as EvolutionItemId;
    return EVOLUTION_ITEMS.includes(item) ? { kind: 'item', item } : null;
  }
  if (e.kind === 'trade') return { kind: 'item', item: 'link-cable' };
  if (e.kind === 'friendship') return { kind: 'item', item: 'soothe-bell' };
  return null;
}

export interface ChainStage {
  speciesId: number;
  /** How it evolves from the stage before (null for the first one). */
  by: EvolveBy | null;
}

/** The whole family, stage by stage (stage 0 is the basic one; Eevee's stage 1 has three Pokémon). */
export function evolutionChain(id: number): ChainStage[][] {
  // Walk back only through evolutions this game does: a baby that evolves in a way the game can't (Happiny into
  // Chansey) isn't part of the family shown here, or the Pokémon itself would be missing from its own chain.
  let root = species(id);
  while (root.evolvesFrom !== null && hasSpecies(root.evolvesFrom)) {
    const parent = species(root.evolvesFrom);
    const step = parent.evolutions.find(e => e.to === root.id);
    if (!step || !evolveBy(step)) break;
    root = parent;
  }
  const stages: ChainStage[][] = [[{ speciesId: root.id, by: null }]];
  for (;;) {
    const next = stages[stages.length - 1].flatMap(stage =>
      species(stage.speciesId).evolutions.flatMap(e => {
        const by = evolveBy(e);
        return by ? [{ speciesId: e.to, by }] : [];
      }),
    );
    if (next.length === 0) return stages;
    stages.push(next);
  }
}

export type Habitat = HuntKind | 'safari';

export interface FoundAt {
  cityId: string;
  where: Habitat;
  /** The weakest rod that can hook it (water only). */
  rod: RodId | null;
  minLevel: number;
  maxLevel: number;
}

/** Every hunting ground in a region where it appears (with the levels), in story order. */
export function whereToFind(id: number, region: Region): FoundAt[] {
  const found: FoundAt[] = [];
  const add = (cityId: string, where: Habitat, rod: RodId | null, table: { speciesId: number; minLevel: number; maxLevel: number }[]) => {
    const entries = table.filter(e => e.speciesId === id);
    if (entries.length === 0) return false;
    found.push({ cityId, where, rod, minLevel: Math.min(...entries.map(e => e.minLevel)), maxLevel: Math.max(...entries.map(e => e.maxLevel)) });
    return true;
  };
  for (const city of region.cities) {
    for (const kind of ['grass', 'cave', 'rare'] as const) if (city.hunts[kind]) add(city.id, kind, null, encounterTable(city, kind, null));
    if (city.hunts.water) for (const rod of RODS) if (add(city.id, 'water', rod, encounterTable(city, 'water', rod))) break;
    if (city.safari) add(city.id, 'safari', null, tableForAreas(city.safari, 'walk'));
  }
  return found;
}

// ── Filters (the Pokédex screen's bar) ─────────────────────────────────────────────────────────────────────────────

export interface DexFilter {
  /** Only the species caught at some point ("owned", as the games' Pokédex says; released ones count). */
  owned: boolean;
  type: string | null;
  legendary: boolean;
  mythical: boolean;
  /** A range of Pokédex numbers (inclusive). */
  range: readonly [number, number] | null;
}

export const NO_FILTER: DexFilter = { owned: false, type: null, legendary: false, mythical: false, range: null };

/** The number ranges to pick from: 30 at a time up to the region's last (the last range takes what is left). */
export function dexRanges(last: number): (readonly [number, number])[] {
  const ranges: [number, number][] = [];
  for (let from = 1; from <= last; from += 30) ranges.push([from, Math.min(last, from + 29)]);
  // A tiny last range (Kanto's 151) joins the one before.
  const tail = ranges[ranges.length - 1];
  if (ranges.length > 1 && tail[1] - tail[0] < 5) ranges.splice(-2, 2, [ranges[ranges.length - 2][0], tail[1]]);
  return ranges;
}

/** Every type some species of a region's Pokédex has, alphabetically. */
export const dexTypes = (last: number): string[] => [...new Set(allSpecies().filter(s => s.id <= last).flatMap(s => s.types))].sort();

export const isFiltered = (filter: DexFilter) =>
  filter.owned || filter.type !== null || filter.legendary || filter.mythical || filter.range !== null;

/**
 * The species that pass the filter, in Pokédex order. Every condition must hold, except Legendary and Mythical: with
 * both on, either one will do (they never overlap).
 */
export function filterDex(ids: readonly number[], filter: DexFilter, owned: (id: number) => boolean): number[] {
  return ids.filter(id => {
    const s = species(id);
    if (filter.owned && !owned(id)) return false;
    if (filter.type && !s.types.includes(filter.type)) return false;
    if ((filter.legendary || filter.mythical) && !((filter.legendary && s.legendary) || (filter.mythical && s.mythical))) return false;
    if (filter.range && (id < filter.range[0] || id > filter.range[1])) return false;
    return true;
  });
}
