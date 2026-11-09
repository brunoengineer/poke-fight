// The bag: pockets, contents, and what an item can do to a Pokémon.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { bagContents, checkUse, pocketOf, usableFromBag } from './bag';
import { createPokemon, maxHpOf } from './pokemon';

const mon = (slug: string, level = 20) => createPokemon(speciesBySlug(slug).id, level);

describe('the bag', () => {
  it('sorts items into pockets, in order, leaving out empty pockets', () => {
    expect(bagContents({ 'fire-stone': 1, potion: 3, 'poke-ball': 5 })).toEqual([
      { pocket: 'medicine', items: [{ id: 'potion', count: 3 }] },
      { pocket: 'balls', items: [{ id: 'poke-ball', count: 5 }] },
      { pocket: 'evolution', items: [{ id: 'fire-stone', count: 1 }] },
    ]);
    expect(bagContents({})).toEqual([]);
    expect(pocketOf('old-rod')).toBe('key');
  });

  it('potions and evolution items are used on a Pokémon from the bag; balls and rods are not', () => {
    expect(['potion', 'thunder-stone', 'link-cable'].every(id => usableFromBag(id as never))).toBe(true);
    expect(['poke-ball', 'old-rod'].some(id => usableFromBag(id as never))).toBe(false);
  });

  it('a potion heals a hurt Pokémon; not a healthy or a fainted one', () => {
    const hurt = { ...mon('pidgey'), hp: 10 };
    expect(checkUse('potion', hurt)).toEqual({ ok: true });
    expect(checkUse('potion', mon('pidgey'))).toEqual({ ok: false, reason: 'fullHp' });
    expect(checkUse('potion', { ...hurt, hp: 0 })).toEqual({ ok: false, reason: 'fainted' });
    expect(maxHpOf(hurt)).toBeGreaterThan(10);
  });

  it('a stone evolves the Pokémon it works on, and says why not otherwise', () => {
    expect(checkUse('thunder-stone', mon('pikachu'))).toEqual({ ok: true });
    expect(checkUse('fire-stone', mon('pikachu'))).toEqual({ ok: false, reason: 'noEffect' });
    expect(checkUse('thunder-stone', { ...mon('pikachu'), hp: 0 })).toEqual({ ok: false, reason: 'fainted' });
    expect(checkUse('link-cable', mon('kadabra', 30))).toEqual({ ok: true });
  });

  it("nothing evolves past the region's Pokédex: a Dusk Stone does nothing for Murkrow in Hoenn (Honchkrow is #430)", () => {
    expect(checkUse('dusk-stone', mon('murkrow'), 386)).toEqual({ ok: false, reason: 'noEffect' });
    expect(checkUse('dusk-stone', mon('murkrow'), 493)).toEqual({ ok: true });
  });
});
