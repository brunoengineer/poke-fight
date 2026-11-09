// The Pokédex: what the player knows, what they own, evolutions as this game does them, where to find each species.
// And releasing a Pokémon (the box).

import { describe, expect, it } from 'vitest';
import { species, speciesBySlug } from '../data/pokedex';
import { canRelease, release } from './box';
import { createPokemon } from './pokemon';
import { dexNumbers, dexStatus, evolutionChain, ownedCount, whereToFind } from './pokedex';

const id = (slug: string) => speciesBySlug(slug).id;

describe('the Pokédex', () => {
  it('lists the 151 in order, each with its page (genus, size, entry)', () => {
    const numbers = dexNumbers();
    expect(numbers).toHaveLength(151);
    expect(numbers[0]).toBe(1);
    expect(numbers[150]).toBe(151);
    expect(species(25).dex).toMatchObject({ genus: 'Mouse Pokémon', heightM: 0.4, weightKg: 6 });
    expect(species(25).dex.entry.length).toBeGreaterThan(20);
  });

  it('unseen, seen or caught; a released Pokémon stays caught, but is no longer owned', () => {
    const dex = { seen: [16, 19], caught: [16] };
    expect([dexStatus(dex, 16), dexStatus(dex, 19), dexStatus(dex, 25)]).toEqual(['caught', 'seen', 'unseen']);
    const team = { party: [createPokemon(16, 5), createPokemon(4, 5)], box: [createPokemon(16, 3)] };
    expect(ownedCount(team, 16)).toBe(2);
    const after = release(team, 'box', 0);
    expect(ownedCount(after, 16)).toBe(1);
    expect(dexStatus(dex, 16)).toBe('caught');
  });

  it("evolutions as this game does them: levels, stones, and the Link Cable for trades (later generations' left out)", () => {
    expect(evolutionChain(id('charmeleon'))).toEqual([
      [{ speciesId: 4, by: null }],
      [{ speciesId: 5, by: { kind: 'level', level: 16 } }],
      [{ speciesId: 6, by: { kind: 'level', level: 36 } }],
    ]);
    expect(evolutionChain(id('kadabra'))[2]).toEqual([{ speciesId: 65, by: { kind: 'item', item: 'link-cable' } }]);
    // Eevee: three stones (no Espeon, Umbreon… in Kanto's data); Golbat stops there (no Crobat).
    expect(evolutionChain(id('eevee'))[1].map(s => s.by)).toEqual([
      { kind: 'item', item: 'water-stone' },
      { kind: 'item', item: 'thunder-stone' },
      { kind: 'item', item: 'fire-stone' },
    ]);
    expect(evolutionChain(id('zubat'))).toHaveLength(2);
    expect(evolutionChain(id('tauros'))).toEqual([[{ speciesId: id('tauros'), by: null }]]);
  });

  it('where to find it: Pidgey in the grass from Pallet; Magikarp with the Old Rod; Tauros in the Safari Zone', () => {
    const pidgey = whereToFind(id('pidgey'));
    expect(pidgey[0]).toMatchObject({ cityId: 'pallet', where: 'grass', rod: null });
    expect(whereToFind(id('magikarp')).find(f => f.where === 'water')).toMatchObject({ rod: 'old-rod' });
    expect(whereToFind(id('tauros'))).toEqual([expect.objectContaining({ cityId: 'fuchsia', where: 'safari' })]);
    expect(whereToFind(id('bulbasaur'))).toEqual([]);
  });
});

describe('releasing', () => {
  it('any boxed Pokémon; a party Pokémon only if one stays in the party', () => {
    const one = { party: [createPokemon(4, 5)], box: [createPokemon(16, 3)] };
    expect(canRelease(one, 'party')).toBe(false);
    expect(() => release(one, 'party', 0)).toThrow();
    expect(release(one, 'box', 0)).toEqual({ party: one.party, box: [] });
    const two = { party: [createPokemon(4, 5), createPokemon(16, 3)], box: [] };
    expect(release(two, 'party', 0).party.map(p => p.speciesId)).toEqual([16]);
  });
});
