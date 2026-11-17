// Every species can be obtained (decided after milestone 14), and since 2026-11-17 in every region's own journey: a
// region's Pokédex (every species up to its generation's last) can be completed there. Caught in its hunting grounds
// (grass, caves, water, the Safari Zone, the League's Hidden Grove, the visitors from earlier regions), met in its
// Legends' Sanctuary (its own legendaries and the earlier regions'), or evolved from one of those in a way this game
// supports (a level, a stone, the Link Cable, the Soothe Bell).

import { describe, expect, it } from 'vitest';
import { hasSpecies, species, speciesBySlug } from '../data/pokedex';
import { REGIONS } from '../data/regions';
import { groveArea, huntTable, tableForAreas } from './encounters';
import { cityPokemon } from './story';
import { obtainableIn, VISITOR_FRESH, visitingLegends, visitorTables } from './visitors';

describe('every species', () => {
  for (const region of REGIONS) {
    it(`${region.id}: its whole Pokédex (1–${region.lastSpecies}) can be obtained in its own journey`, () => {
      const found = obtainableIn(region);
      const missing = Array.from({ length: region.lastSpecies }, (_, i) => i + 1).filter(id => hasSpecies(id) && !found.has(id));
      expect(missing.map(id => species(id).slug)).toEqual([]);
    });
  }

  it('Mr. Mime, for one, is in Kanto (the Hidden Grove), not only in Sinnoh', () => {
    const kanto = REGIONS.find(r => r.id === 'kanto')!;
    expect(kanto.grove.map(([slug]) => slug)).toContain('mr-mime');
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

  it('only what nothing else in the region reaches is in its grove (no duplicates of its ordinary encounters)', () => {
    for (const region of REGIONS) {
      const groveIds = new Set(region.grove.map(([slug]) => speciesBySlug(slug).id));
      for (const city of region.cities) {
        const elsewhere = cityPokemon({ ...city, hunts: { ...city.hunts, rare: undefined } });
        for (const id of elsewhere) expect(groveIds.has(id), `${species(id).slug} is also wild in ${city.id}`).toBe(false);
      }
    }
  });
});

describe('visitors from earlier regions', () => {
  it("Kanto has none; Sinnoh has Kanto's, Johto's and Hoenn's", () => {
    const by = (id: string) => REGIONS.find(r => r.id === id)!;
    expect([...visitorTables(by('kanto')).keys()]).toEqual([]);
    expect([...visitorTables(by('sinnoh')).keys()]).toEqual(['kanto', 'johto', 'hoenn']);
    expect(visitingLegends(by('sinnoh')).map(g => [g.from, g.legendaries.length])).toEqual([
      ['kanto', 5],
      ['johto', 6],
      ['hoenn', 10],
    ]);
  });

  it('a visitor not caught yet comes 6 times as often as one already caught (ordinary grounds: twice)', () => {
    const sinnoh = REGIONS.find(r => r.id === 'sinnoh')!;
    const league = sinnoh.cities.find(c => c.id === sinnoh.league.city)!;
    const raw = visitorTables(sinnoh).get('kanto')!;
    const caught = raw.slice(1).map(e => e.speciesId);
    const table = huntTable(league, raw, caught, VISITOR_FRESH);
    expect(VISITOR_FRESH).toBe(6);
    expect(table[0].weight / table[1].weight).toBeCloseTo(6);
  });

  it("each ground holds only its region's generation, no legendaries, nothing the region already gives, first forms Lv. 30–36", () => {
    for (const region of REGIONS) {
      const wild = new Set(region.cities.flatMap(cityPokemon));
      let first = 1;
      for (const from of REGIONS.filter(r => r.lastSpecies < region.lastSpecies)) {
        for (const e of visitorTables(region).get(from.id) ?? []) {
          const s = species(e.speciesId);
          const where = `${region.id} ← ${from.id}: ${s.slug}`;
          expect(e.speciesId >= first && e.speciesId <= from.lastSpecies, where).toBe(true);
          expect(s.legendary || s.mythical, where).toBe(false);
          expect(wild.has(e.speciesId), where).toBe(false);
          expect([e.minLevel, e.maxLevel], where).toEqual(s.evolvesFrom === null ? [30, 36] : [40, 46]);
        }
        first = from.lastSpecies + 1;
      }
    }
  });
});
