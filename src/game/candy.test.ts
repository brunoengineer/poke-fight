// The Rare Candy (decided after milestone 14: leveling up late took too long): one level for ₽2000, sold at each
// region's League city.

import { describe, expect, it } from 'vitest';
import { ITEMS } from '../data/items';
import { speciesBySlug } from '../data/pokedex';
import { REGIONS } from '../data/regions';
import { checkUse, pocketOf, usableFromBag } from './bag';
import { createPokemon } from './pokemon';
import { levelEvolution, useRareCandy } from './progress';
import { MAX_LEVEL, xpForLevel } from './xp';

const mon = (slug: string, level: number) => createPokemon(speciesBySlug(slug).id, level);

describe('the Rare Candy', () => {
  it('costs 2000, is medicine, used from the bag, and sold in every League city (and only there)', () => {
    expect(ITEMS['rare-candy']).toEqual({ id: 'rare-candy', kind: 'candy', price: 2000 });
    expect(pocketOf('rare-candy')).toBe('medicine');
    expect(usableFromBag('rare-candy')).toBe(true);
    for (const r of REGIONS) {
      for (const c of r.cities) expect(c.shop?.includes('rare-candy') ?? false, c.id).toBe(c.id === r.league.city);
    }
  });

  it('raises exactly one level, to the start of it, and teaches that level’s moves', () => {
    const before = mon('charmander', 8);
    const grown = useRareCandy(before)!;
    expect(grown.pokemon.level).toBe(9);
    expect(grown.pokemon.xp).toBe(xpForLevel(speciesBySlug('charmander').growthRate, 9));
    expect(grown.levelUps.map(l => l.level)).toEqual([9]);
    const learnedAt9 = speciesBySlug('charmander').learnset.filter(e => e.level === 9).map(e => e.move);
    for (const m of learnedAt9) expect(grown.pokemon.moves).toContain(m);
  });

  it('can reach a level evolution (the game then evolves it)', () => {
    const grown = useRareCandy(mon('charmander', 15))!;
    expect(grown.pokemon.level).toBe(16);
    expect(levelEvolution(grown.pokemon)?.to).toBe(speciesBySlug('charmeleon').id);
  });

  it('does nothing to a fainted Pokémon or one at the top level', () => {
    expect(useRareCandy({ ...mon('pikachu', 20), hp: 0 })).toBeNull();
    expect(useRareCandy(mon('pikachu', MAX_LEVEL))).toBeNull();
    expect(checkUse('rare-candy', { ...mon('pikachu', 20), hp: 0 })).toEqual({ ok: false, reason: 'fainted' });
    expect(checkUse('rare-candy', mon('pikachu', MAX_LEVEL))).toEqual({ ok: false, reason: 'maxLevel' });
    expect(checkUse('rare-candy', mon('pikachu', 20))).toEqual({ ok: true });
  });
});
