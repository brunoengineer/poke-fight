// Every species can be obtained (decided after milestone 14): caught in some region's hunting grounds (grass, caves,
// water, the Safari Zone, the League's Hidden Grove), met in a Legends' Sanctuary, or evolved from one of those in a
// way this game supports (a level, a stone, the Link Cable, the Soothe Bell).

import { describe, expect, it } from 'vitest';
import { hasSpecies, species, speciesBySlug } from '../data/pokedex';
import { REGIONS } from '../data/regions';
import { groveArea, tableForAreas } from './encounters';
import { evolveBy } from './pokedex';
import { cityPokemon } from './story';

/** Everything that can be caught or met somewhere, then everything those evolve into. */
function obtainable(): Set<number> {
  const found = new Set<number>();
  for (const region of REGIONS) {
    for (const city of region.cities) for (const id of cityPokemon(city)) found.add(id);
    for (const l of region.sanctuary.legendaries) found.add(speciesBySlug(l.species).id);
  }
  const queue = [...found];
  while (queue.length > 0) {
    for (const e of species(queue.pop()!).evolutions) {
      if (evolveBy(e) && !found.has(e.to)) {
        found.add(e.to);
        queue.push(e.to);
      }
    }
  }
  return found;
}

describe('every species', () => {
  it('can be obtained somewhere, all 493 of them (the starters too)', () => {
    const found = obtainable();
    const missing = Array.from({ length: 493 }, (_, i) => i + 1).filter(id => hasSpecies(id) && !found.has(id));
    expect(missing.map(id => species(id).slug)).toEqual([]);
  });

  it("each region's Hidden Grove is hunted in its League city, and holds that generation's Pokémon", () => {
    let first = 1;
    for (const region of REGIONS) {
      const league = region.cities.find(c => c.id === region.league.city)!;
      expect(league.hunts.rare, region.id).toEqual([groveArea(region.id)]);
      const table = tableForAreas([groveArea(region.id)], 'walk');
      expect(table.length, region.id).toBe(region.grove.length);
      for (const e of table) {
        expect(e.speciesId, `${region.id}: ${species(e.speciesId).slug}`).toBeGreaterThanOrEqual(first);
        expect(e.speciesId, `${region.id}: ${species(e.speciesId).slug}`).toBeLessThanOrEqual(region.lastSpecies);
      }
      // Every starter of the region can be caught there (the ones not chosen).
      for (const starter of region.starters) expect(table.some(e => e.speciesId === starter), `${region.id}: starter ${starter}`).toBe(true);
      first = region.lastSpecies + 1;
    }
  });

  it('only what nothing else reaches is in a grove (no duplicates of ordinary encounters)', () => {
    for (const region of REGIONS) {
      const groveIds = new Set(region.grove.map(([slug]) => speciesBySlug(slug).id));
      for (const r of REGIONS) {
        for (const city of r.cities) {
          const elsewhere = cityPokemon({ ...city, hunts: { ...city.hunts, rare: undefined } });
          for (const id of elsewhere) expect(groveIds.has(id), `${species(id).slug} is also wild in ${city.id}`).toBe(false);
        }
      }
    }
  });
});
