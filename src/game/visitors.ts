// Visitors (decided 2026-11-17): every region's Pokédex can be completed in that region. A region's own games only
// have some of the earlier generations' Pokémon (Hoenn's have none of Kanto's starters), so each League city also has,
// for every earlier region, a hunting ground with that region's Pokémon this one can't give any other way; and each
// Legends' Sanctuary welcomes the earlier regions' legendaries. Both are worked out here from the data (not listed by
// hand), so they stay complete when the encounter tables change. The region's own leftovers are in its Hidden Grove.

import { hasSpecies, species, speciesBySlug } from '../data/pokedex';
import { REGIONS, type Legendary, type Region, type RegionId } from '../data/regions';
import type { EncounterEntry } from './encounters';
import { evolveBy } from './pokedex';
import { cityPokemon } from './story';

/** In a visitors' ground, a species not caught yet comes this much more often (ordinary grounds: twice). */
export const VISITOR_FRESH = 6;

/** Visitors' levels: a first form Lv. 30–36, one that comes already evolved Lv. 40–46 (as in the Hidden Grove). */
const BASE_LEVELS: [number, number] = [30, 36];
const EVOLVED_LEVELS: [number, number] = [40, 46];

/** The regions before this one (their generations are in its Pokédex). */
const earlier = (region: Region): Region[] => REGIONS.filter(r => r.lastSpecies < region.lastSpecies);

/** What evolving reaches from these, in this region (nothing past its Pokédex, only evolutions this game can do). */
function withEvolutions(start: Iterable<number>, last: number): Set<number> {
  const found = new Set(start);
  const queue = [...found];
  while (queue.length > 0) {
    for (const e of species(queue.pop()!).evolutions) {
      if (e.to <= last && evolveBy(e) && !found.has(e.to)) {
        found.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return found;
}

/** What a region gives without visitors: its hunting grounds (the Hidden Grove too), its sanctuary, its starters. */
function ownObtainable(region: Region): Set<number> {
  const start = new Set<number>(region.starters);
  for (const city of region.cities) for (const id of cityPokemon(city)) start.add(id);
  for (const l of region.sanctuary.legendaries) start.add(speciesBySlug(l.species).id);
  return withEvolutions(start, region.lastSpecies);
}

const TABLES = new Map<RegionId, Map<RegionId, EncounterEntry[]>>();

/**
 * Each earlier region's visitors here: its generation's Pokémon (not legendaries) this region doesn't give, only the
 * first form missing from each family (evolving does the rest), all equally likely. Empty tables are left out.
 */
export function visitorTables(region: Region): Map<RegionId, EncounterEntry[]> {
  let tables = TABLES.get(region.id);
  if (tables) return tables;
  tables = new Map();
  const own = ownObtainable(region);
  const missing = new Set(Array.from({ length: region.lastSpecies }, (_, i) => i + 1).filter(id => hasSpecies(id) && !own.has(id)));
  // The first missing form of each family: its earlier form is obtainable, or can't evolve into it here.
  const roots = [...missing].filter(id => {
    const s = species(id);
    if (s.legendary || s.mythical) return false;
    if (s.evolvesFrom === null || !missing.has(s.evolvesFrom)) return true;
    const e = species(s.evolvesFrom).evolutions.find(x => x.to === id);
    return !e || !evolveBy(e);
  });
  let first = 1;
  for (const from of earlier(region)) {
    const [low, high] = [first, from.lastSpecies];
    first = from.lastSpecies + 1;
    const entries = roots
      .filter(id => id >= low && id <= high)
      .map(id => {
        const [minLevel, maxLevel] = species(id).evolvesFrom === null ? BASE_LEVELS : EVOLVED_LEVELS;
        return { speciesId: id, minLevel, maxLevel, weight: 1 };
      });
    if (entries.length > 0) tables.set(from.id, entries);
  }
  TABLES.set(region.id, tables);
  return tables;
}

/** The earlier regions' legendaries, by region, that this region's own sanctuary doesn't have. */
export function visitingLegends(region: Region): { from: RegionId; legendaries: Legendary[] }[] {
  const own = new Set(region.sanctuary.legendaries.map(l => l.species));
  return earlier(region)
    .map(r => ({ from: r.id, legendaries: r.sanctuary.legendaries.filter(l => !own.has(l.species)) }))
    .filter(group => group.legendaries.length > 0);
}

/** Everything a journey in this region can obtain: its own, its visitors, its visiting legends, and their evolutions. */
export function obtainableIn(region: Region): Set<number> {
  const all = ownObtainable(region);
  for (const table of visitorTables(region).values()) for (const e of table) all.add(e.speciesId);
  for (const group of visitingLegends(region)) for (const l of group.legendaries) all.add(speciesBySlug(l.species).id);
  return withEvolutions(all, region.lastSpecies);
}
