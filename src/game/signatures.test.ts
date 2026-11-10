// Moves of their own (plan.md §4.9): which Pokémon have one, and that a caught one brings it into the fight.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { REGIONS } from '../data/regions';
import { createPokemon, toFighter } from './pokemon';
import { LEGEND_FORMS, SIGNATURES, legendOf, signatureOf } from './signatures';

const id = (slug: string) => speciesBySlug(slug).id;

describe('signature moves', () => {
  it('the eleven famous Pokémon have one, each in a form of its own, of its own type', () => {
    expect(Object.keys(SIGNATURES).sort()).toEqual(
      ['blaziken', 'charizard', 'dragonite', 'flygon', 'garchomp', 'gardevoir', 'gengar', 'kingler', 'lapras', 'lucario', 'pikachu'].sort(),
    );
    const shapes = Object.values(SIGNATURES).map(s => s.shape);
    expect(new Set(shapes).size).toBe(shapes.length);
    for (const [slug, s] of Object.entries(SIGNATURES)) expect(speciesBySlug(slug).types, slug).toContain(s.type);
  });

  it('only those: their evolutions and the others have none', () => {
    expect(signatureOf(id('raichu'))).toBeUndefined();
    expect(signatureOf(id('charmeleon'))).toBeUndefined();
    expect(signatureOf(id('pikachu'))).toMatchObject({ name: 'Thunder', shape: 'strike', power: 90 });
  });

  it('a caught Pikachu brings Thunder into the fight', () => {
    expect(toFighter(createPokemon(id('pikachu'), 20)).loadout.signature).toMatchObject({ name: 'Thunder', type: 'electric' });
    expect(toFighter(createPokemon(id('raichu'), 20)).loadout).not.toHaveProperty('signature');
  });
});

describe('legendary moves', () => {
  it('every sanctuary legendary has one: its first boss attack, in its form, of its first type', () => {
    for (const r of REGIONS) {
      for (const l of r.sanctuary.legendaries) {
        const s = speciesBySlug(l.species);
        const legend = legendOf(s.id, s.types);
        expect(legend, l.species).toEqual({ attack: l.attacks[0], type: s.types[0], category: expect.any(String), shape: LEGEND_FORMS[l.attacks[0] as keyof typeof LEGEND_FORMS] });
      }
    }
    expect(legendOf(id('pikachu'), ['electric'])).toBeUndefined();
  });

  it('a caught Mewtwo brings its move into the fight', () => {
    expect(toFighter(createPokemon(id('mewtwo'), 70)).loadout.legend).toBeDefined();
  });
});
