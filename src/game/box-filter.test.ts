// The PC box's favorites and filters (decided 2026-11-15).

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { boxShown, boxTypes, isBoxFiltered, NO_BOX_FILTER, place, sendToBox, toggleFavorite, type Team } from './box';
import { createPokemon } from './pokemon';

const mon = (slug: string, level = 20) => createPokemon(speciesBySlug(slug).id, level);
// Box: Charmander (fire), Pidgey (normal/flying), Charizard (fire/flying), Rattata (normal).
const team = (): Team => ({ party: [mon('pikachu')], box: [mon('charmander'), mon('pidgey'), mon('charizard', 40), mon('rattata')] });

describe('favorites', () => {
  it('a star on and off; only favorites carry the field', () => {
    const marked = toggleFavorite(team(), 'box', 2);
    expect(marked.box[2].favorite).toBe(true);
    expect(marked.box.filter(p => 'favorite' in p)).toHaveLength(1);
    const unmarked = toggleFavorite(marked, 'box', 2);
    expect('favorite' in unmarked.box[2]).toBe(false);
    expect(() => toggleFavorite(team(), 'box', 9)).toThrow();
  });

  it('the star goes with the Pokémon: to the party, the box, a swap', () => {
    let t = toggleFavorite(team(), 'party', 0);
    t = { ...t, party: [...t.party, mon('rattata')] };
    t = sendToBox(t, 0);
    expect(t.box.at(-1)).toMatchObject({ speciesId: speciesBySlug('pikachu').id, favorite: true });
    t = place(t, { where: 'box', index: t.box.length - 1 }, { where: 'box', index: 0 });
    expect(t.box[0]).toMatchObject({ speciesId: speciesBySlug('pikachu').id, favorite: true });
  });
});

describe('the box filters', () => {
  it('by type (either of its types), by favorites, both; the indexes stay the box places', () => {
    const t = toggleFavorite(toggleFavorite(team(), 'box', 1), 'box', 2);
    expect(boxShown(t.box, NO_BOX_FILTER)).toEqual([0, 1, 2, 3]);
    expect(boxShown(t.box, { ...NO_BOX_FILTER, type: 'fire' })).toEqual([0, 2]);
    expect(boxShown(t.box, { ...NO_BOX_FILTER, type: 'flying' })).toEqual([1, 2]);
    expect(boxShown(t.box, { ...NO_BOX_FILTER, favorites: true })).toEqual([1, 2]);
    expect(boxShown(t.box, { type: 'fire', favorites: true })).toEqual([2]);
    expect(boxShown(t.box, { ...NO_BOX_FILTER, type: 'water' })).toEqual([]);
    expect([isBoxFiltered(NO_BOX_FILTER), isBoxFiltered({ ...NO_BOX_FILTER, favorites: true })]).toEqual([false, true]);
  });

  it('the types to choose from: only those in the box, with how many have each', () => {
    expect(boxTypes(team().box)).toEqual([
      { type: 'fire', count: 2 },
      { type: 'flying', count: 2 },
      { type: 'normal', count: 2 },
    ]);
    expect(boxTypes([])).toEqual([]);
  });
});
