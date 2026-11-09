// From data to fighter: stats, known moves, default specials and their shapes.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { HP_UNITS } from '../fight/constants';
import { TYPES } from '../data/types';
import { BIG_SHAPES, bigShape, defaultSpecials, elementalShape, movesKnownAt, STRUGGLE } from './moves';
import { createPokemon, displayHp, loadoutOf, toFighter } from './pokemon';
import { mobility, statsAt, uniformIvs } from './stats';

const id = (slug: string) => speciesBySlug(slug).id;

describe('stats', () => {
  it('follow the official formula (checked against known values)', () => {
    // Pikachu, Lv. 50, perfect IVs, no EVs: 110 HP, 75 Attack.
    expect(statsAt(speciesBySlug('pikachu').stats, 50, uniformIvs(31))).toMatchObject({ hp: 110, atk: 75 });
    // Chansey, Lv. 100, perfect IVs: 641 HP.
    expect(statsAt(speciesBySlug('chansey').stats, 100, uniformIvs(31)).hp).toBe(641);
  });

  it('speed in the fight goes from 85% (slowest) to 115% (fastest), whatever the level', () => {
    expect(mobility(0)).toBe(85);
    expect(mobility(speciesBySlug('slowpoke').stats.spe)).toBe(88);
    expect(mobility(speciesBySlug('electrode').stats.spe)).toBe(115); // base Speed 150 (modern data)
    expect(mobility(200)).toBe(115);
  });
});

describe('moves', () => {
  it('knows the moves learned up to its level, plus gifts', () => {
    const charmander = speciesBySlug('charmander');
    expect(movesKnownAt(charmander, 5)).toEqual(['growl', 'scratch']);
    expect(movesKnownAt(charmander, 9)).toContain('ember');
    expect(movesKnownAt(charmander, 5, ['ember'])).toEqual(['growl', 'scratch', 'ember']);
  });

  it('elemental slot: beams are beams, everything else is a projectile', () => {
    expect(elementalShape('psybeam')).toBe('beam');
    expect(elementalShape('hyper-beam')).toBe('beam');
    expect(elementalShape('aurora-beam')).toBe('beam');
    expect(elementalShape('ember')).toBe('projectile');
    expect(elementalShape('scratch')).toBe('projectile');
  });

  it("big slot: the form comes from the move's type (plan.md §4.9); Normal: physical → Rush, special → beam", () => {
    expect(bigShape('earthquake')).toBe('quake');
    expect(bigShape('hydro-pump')).toBe('surf');
    expect(bigShape('sludge-bomb')).toBe('surf');
    expect(bigShape('flamethrower')).toBe('tornado');
    expect(bigShape('fire-punch')).toBe('tornado'); // physical or special: the type decides
    expect(bigShape('solar-beam')).toBe('solar');
    expect(bigShape('rock-slide')).toBe('barrage');
    expect(bigShape('thunder')).toBe('strike');
    expect(bigShape('psychic')).toBe('burst');
    expect(bigShape('blizzard')).toBe('blizzard');
    expect(bigShape('take-down')).toBe('rush');
    expect(bigShape('body-slam')).toBe('rush');
    expect(bigShape('hyper-beam')).toBe('beam');
  });

  it('every type has a big form', () => {
    for (const type of TYPES) expect(BIG_SHAPES[type] ?? (type === 'normal' ? 'by category' : undefined), type).toBeDefined();
  });

  it('default specials: own type for the elemental, strongest (with the same-type bonus) for the big', () => {
    const charmander = speciesBySlug('charmander');
    // Lv. 5 without Ember: only Scratch.
    expect(defaultSpecials(charmander, movesKnownAt(charmander, 5))).toEqual({ elemental: 'scratch', big: 'scratch' });
    // With the Professor's Ember: Ember (40 × 1.5) beats Scratch (40) in both slots.
    expect(defaultSpecials(charmander, movesKnownAt(charmander, 5, ['ember']))).toEqual({ elemental: 'ember', big: 'ember' });
  });

  it('never picks moves that knock out the user', () => {
    const geodude = speciesBySlug('geodude');
    expect(movesKnownAt(geodude, 30)).toContain('self-destruct');
    expect(defaultSpecials(geodude, movesKnownAt(geodude, 30)).big).not.toBe('self-destruct');
  });

  it('a Pokémon without any damaging move uses Struggle', () => {
    const abra = speciesBySlug('abra');
    expect(defaultSpecials(abra, movesKnownAt(abra, 20))).toEqual({ elemental: STRUGGLE, big: STRUGGLE });
  });
});

describe('Pokémon → fighter', () => {
  it('has full HP (in fight units) and its default specials', () => {
    const kadabra = createPokemon(id('kadabra'), 30);
    const fighter = toFighter(kadabra);
    expect(fighter.maxHp).toBe(statsAt(speciesBySlug('kadabra').stats, 30).hp * HP_UNITS);
    expect(fighter).toMatchObject({ speciesId: 64, name: 'Kadabra', types: ['psychic'], level: 30, hp: fighter.maxHp });
    expect(loadoutOf(kadabra).elemental).toEqual({ name: 'Psybeam', type: 'psychic', power: 65, category: 'special', shape: 'beam' });
  });

  it('menus show real HP (fight HP / 10, rounded up)', () => {
    expect(displayHp(790)).toBe(79);
    expect(displayHp(781)).toBe(79);
    expect(displayHp(1)).toBe(1);
  });
});
