// Sinnoh's own checks, on top of the ones every region gets (regions.test.ts): Platinum's gym order, the big store,
// hunting grounds that keep bringing new Pokémon, and a sanctuary with the region's legends.

import { describe, expect, it } from 'vitest';
import { isBossAttack } from '../../fight/boss';
import { tableForAreas } from '../../game/encounters';
import { EVOLUTION_ITEMS, type ItemId } from '../items';
import { allSpecies } from '../pokedex';
import { SINNOH } from './sinnoh';

const r = SINNOH;

describe('Sinnoh', () => {
  it('gyms in Platinum’s order: Fantina third, before Maylene', () => {
    expect(r.gyms.map(g => g.leader)).toEqual(['Roark', 'Gardenia', 'Fantina', 'Maylene', 'Crasher Wake', 'Byron', 'Candice', 'Volkner']);
    expect(r.gyms.map(g => g.city)).toEqual(['oreburgh', 'eterna', 'hearthome', 'veilstone', 'pastoria', 'canalave', 'snowpoint', 'sunyshore']);
  });

  it('the Champion is Cynthia, not the rival', () => {
    expect(r.league.champion.kind).toBe('member');
    if (r.league.champion.kind === 'member') expect(r.league.champion.team.at(-1)).toEqual(['garchomp', 62]);
  });

  it('rods come in order (Old in Jubilife, Good in Hearthome), and the Veilstone store sells the Super Rod and every evolution item', () => {
    const firstSelling = (item: ItemId) => r.cities.findIndex(c => c.shop?.includes(item));
    expect(r.cities[firstSelling('old-rod')].id).toBe('jubilife');
    expect(r.cities[firstSelling('good-rod')].id).toBe('hearthome');
    expect(r.cities[firstSelling('super-rod')].id).toBe('veilstone');
    const store = r.cities.find(c => c.id === 'veilstone')!;
    for (const item of EVOLUTION_ITEMS) expect(store.shop, item).toContain(item);
  });

  it('every city with walking grounds brings Pokémon not met in the cities before it', () => {
    const met = new Set<number>();
    for (const c of r.cities) {
      const walk = tableForAreas([...(c.hunts.grass ?? []), ...(c.hunts.cave ?? []), ...(c.safari ?? [])], 'walk').map(e => e.speciesId);
      if (walk.length > 0) expect(walk.some(id => !met.has(id)), c.id).toBe(true);
      for (const id of walk) met.add(id);
    }
  });

  it('the sanctuary holds every legendary and mythical of Sinnoh but Phione, with real boss attacks', () => {
    const legends = allSpecies()
      .filter(s => s.id > 479 && s.id <= r.lastSpecies && (s.legendary || s.mythical) && s.slug !== 'phione')
      .map(s => s.slug);
    expect(r.sanctuary.legendaries.map(l => l.species).sort()).toEqual(legends.sort());
    for (const l of r.sanctuary.legendaries) {
      expect(l.attacks.every(isBossAttack), l.species).toBe(true);
      expect(l.level).toBeGreaterThanOrEqual(50);
      expect(l.level).toBeLessThanOrEqual(75);
    }
  });

  it('the sanctuary sits near the middle of the map, joined by a single road', () => {
    const at = r.map.places[r.sanctuary.id];
    expect(Math.abs(at.x - 50)).toBeLessThan(15);
    expect(Math.abs(at.y - 30)).toBeLessThan(12);
    expect(r.map.routes.filter(route => route.includes(r.sanctuary.id))).toHaveLength(1);
  });
});
