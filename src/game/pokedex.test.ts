// The Pokédex: what the player knows, what they own, evolutions as this game does them, where to find each species.
// And releasing a Pokémon (the box).

import { describe, expect, it } from 'vitest';
import { species, speciesBySlug } from '../data/pokedex';
import { dexLanguages, dexText } from '../data/dex-text';
import { canRelease, release } from './box';
import { createPokemon } from './pokemon';
import { DEX_RANGES, dexNumbers, dexStatus, dexTypes, evolutionChain, filterDex, isFiltered, NO_FILTER, ownedCount, whereToFind } from './pokedex';

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

describe('Pokédex filters', () => {
  const all = dexNumbers();
  const none = () => false;

  it('no filter: all 151', () => {
    expect(filterDex(all, NO_FILTER, none)).toHaveLength(151);
    expect(isFiltered(NO_FILTER)).toBe(false);
  });

  it('owned, type, legendary, mythical, number range; all at once must all hold', () => {
    expect(filterDex(all, { ...NO_FILTER, owned: true }, id => id === 25 || id === 4)).toEqual([4, 25]);
    expect(filterDex(all, { ...NO_FILTER, type: 'dragon' }, none)).toEqual([147, 148, 149]);
    expect(filterDex(all, { ...NO_FILTER, legendary: true }, none)).toEqual([144, 145, 146, 150]);
    expect(filterDex(all, { ...NO_FILTER, mythical: true }, none)).toEqual([151]);
    expect(filterDex(all, { ...NO_FILTER, legendary: true, mythical: true }, none)).toEqual([144, 145, 146, 150, 151]);
    expect(filterDex(all, { ...NO_FILTER, range: [1, 30] }, none)).toHaveLength(30);
    expect(filterDex(all, { ...NO_FILTER, range: [1, 30], type: 'fire' }, none)).toEqual([4, 5, 6]);
    expect(filterDex(all, { ...NO_FILTER, legendary: true, type: 'ice' }, none)).toEqual([144]);
  });

  it('the type list covers every species, and the ranges cover 1–151 without gaps', () => {
    const types = dexTypes();
    expect(types).toContain('fire');
    expect(all.every(id => species(id).types.every(t => types.includes(t)))).toBe(true);
    expect(DEX_RANGES.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i))).toEqual(all);
  });
});

describe('the Pokédex in every language', () => {
  it('every species has its kind and entry translated (Portuguese is this game\'s own translation)', () => {
    for (const language of dexLanguages()) {
      for (const n of dexNumbers()) {
        const text = dexText(n, language);
        const english = species(n).dex;
        expect(text.genus).not.toBe('');
        expect(text.entry).not.toBe('');
        expect(text.entry).not.toBe(english.entry);
      }
    }
    expect(dexText(25, 'pt').genus).toBe('Pokémon Rato');
    expect(dexText(25, 'en').genus).toBe('Mouse Pokémon');
  });

  it("Red's all-caps POKéMON is written Pokémon", () => {
    expect(dexNumbers().some(n => species(n).dex.entry.includes('POKéMON'))).toBe(false);
  });
});
