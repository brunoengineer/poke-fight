// Johto's own choices, on top of the checks every region gets (regions.test.ts).

import { describe, expect, it } from 'vitest';
import { encounterTable, oldFaces, tableForAreas } from '../../game/encounters';
import { RODS, type ItemId } from '../items';
import { JOHTO } from './johto';
import type { City } from './types';

const sellers = (item: ItemId) => JOHTO.cities.filter(c => c.shop?.includes(item)).map(c => c.id);

/** Every species of a city's grounds (all kinds, every rod, the Safari Zone). */
const speciesOf = (c: City) =>
  new Set([
    ...encounterTable(c, 'grass', null),
    ...encounterTable(c, 'cave', null),
    ...RODS.flatMap(rod => encounterTable(c, 'water', rod)),
    ...tableForAreas(c.safari ?? [], 'walk'),
  ].map(e => e.speciesId));

describe('Johto', () => {
  it('rods: the Old Rod in the first Mart, the Good Rod in Olivine, the Super Rod only near the end', () => {
    expect(sellers('old-rod')).toEqual(['cherrygrove']);
    expect(sellers('good-rod')).toEqual(['olivine']);
    // HGSS's Super Rod hooks Lv. 40 Pokémon everywhere: not before the 7th badge.
    expect(sellers('super-rod')).toEqual(['blackthorn']);
    expect(JOHTO.cities.find(c => c.id === 'blackthorn')?.badges).toBe(7);
  });

  it('Goldenrod’s Department Store sells the evolution items Johto’s Pokémon need', () => {
    const goldenrod = JOHTO.cities.find(c => c.id === 'goldenrod')?.shop ?? [];
    const items: ItemId[] = ['fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone', 'link-cable', 'soothe-bell'];
    for (const item of items) expect(goldenrod, item).toContain(item);
  });

  it('every city brings Pokémon not met in the cities before it', () => {
    for (const c of JOHTO.cities.slice(1)) {
      const old = oldFaces(c.id);
      expect([...speciesOf(c)].filter(id => !old.has(id)).length, c.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('the sanctuary is near the middle of the map, one road away from Violet City', () => {
    const { x, y } = JOHTO.map.places[JOHTO.sanctuary.id];
    expect(Math.abs(x - 50)).toBeLessThanOrEqual(10);
    expect(Math.abs(y - 30)).toBeLessThanOrEqual(8);
    expect(JOHTO.map.routes.filter(r => r.includes(JOHTO.sanctuary.id))).toEqual([['violet', JOHTO.sanctuary.id]]);
  });
});
