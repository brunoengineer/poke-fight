// The Pokédex's rules: what the player knows about each species (unseen, seen, caught), how many they own now, how
// a species evolves in this game, and where in Kanto it lives. Pure: the screen (ui/screens/pokedex.ts) only shows it.

import { RODS, type EvolutionItemId, type RodId } from '../data/items';
import { allSpecies, hasSpecies, species, type Evolution } from '../data/pokedex';
import { KANTO, type HuntKind } from '../data/regions/kanto';
import { encounterTable, tableForAreas } from './encounters';
import type { Pokemon } from './pokemon';

export type DexStatus = 'unseen' | 'seen' | 'caught';

export interface DexRecord {
  seen: readonly number[];
  caught: readonly number[];
}

/** Every species the game has, in Pokédex order. */
export const dexNumbers = (): number[] => allSpecies().map(s => s.id).sort((a, b) => a - b);

export function dexStatus(dex: DexRecord, id: number): DexStatus {
  if (dex.caught.includes(id)) return 'caught';
  return dex.seen.includes(id) ? 'seen' : 'unseen';
}

/** How many of this species the player has now (party and box): a released Pokémon stays "caught" in the Pokédex. */
export const ownedCount = (team: { party: readonly Pokemon[]; box: readonly Pokemon[] }, id: number) =>
  [...team.party, ...team.box].filter(p => p.speciesId === id).length;

/** How an evolution happens in this game: a level, a stone, or the Link Cable (trading, decided). */
export type EvolveBy = { kind: 'level'; level: number } | { kind: 'item'; item: EvolutionItemId };

/** The evolutions this game supports (into species it has, by level, stone, or trade without a held item). */
export function evolveBy(e: Evolution): EvolveBy | null {
  if (!hasSpecies(e.to)) return null;
  if (e.kind === 'level') return { kind: 'level', level: e.level };
  if (e.kind === 'item') return { kind: 'item', item: e.item as EvolutionItemId };
  if (e.kind === 'trade' && !e.item) return { kind: 'item', item: 'link-cable' };
  return null;
}

export interface ChainStage {
  speciesId: number;
  /** How it evolves from the stage before (null for the first one). */
  by: EvolveBy | null;
}

/** The whole family, stage by stage (stage 0 is the basic one; Eevee's stage 1 has three Pokémon). */
export function evolutionChain(id: number): ChainStage[][] {
  let root = species(id);
  while (root.evolvesFrom !== null && hasSpecies(root.evolvesFrom)) root = species(root.evolvesFrom);
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

/** Every hunting ground in Kanto where it appears (with the levels), in story order. */
export function whereToFind(id: number): FoundAt[] {
  const found: FoundAt[] = [];
  const add = (cityId: string, where: Habitat, rod: RodId | null, table: { speciesId: number; minLevel: number; maxLevel: number }[]) => {
    const entries = table.filter(e => e.speciesId === id);
    if (entries.length === 0) return false;
    found.push({ cityId, where, rod, minLevel: Math.min(...entries.map(e => e.minLevel)), maxLevel: Math.max(...entries.map(e => e.maxLevel)) });
    return true;
  };
  for (const city of KANTO) {
    for (const kind of ['grass', 'cave'] as const) if (city.hunts[kind]) add(city.id, kind, null, encounterTable(city, kind, null));
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

/** The number ranges to pick from (30 at a time). */
export const DEX_RANGES: readonly (readonly [number, number])[] = [
  [1, 30],
  [31, 60],
  [61, 90],
  [91, 120],
  [121, 151],
];

/** Every type some species has, alphabetically. */
export const dexTypes = (): string[] => [...new Set(allSpecies().flatMap(s => s.types))].sort();

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
