// The generated data (scripts/build-data.mjs), checked against facts from the games.

import { describe, expect, it } from 'vitest';
import { allSpecies, move, species, speciesBySlug } from './pokedex';
import { effectiveness, TYPES } from './types';

describe('Gen 1 data', () => {
  it('has the 151 Kanto Pokémon, in order', () => {
    const all = allSpecies();
    expect(all).toHaveLength(151);
    expect(all.map(s => s.id)).toEqual(Array.from({ length: 151 }, (_, i) => i + 1));
    expect([species(1).name, species(25).name, species(150).name, species(151).name]).toEqual(['Bulbasaur', 'Pikachu', 'Mewtwo', 'Mew']);
  });

  it('has modern types and base stats', () => {
    expect(species(1)).toMatchObject({ types: ['grass', 'poison'], stats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 } });
    // Modern typings (plan.md §4.5): Clefairy is Fairy, Magnemite is Electric/Steel.
    expect(speciesBySlug('clefairy').types).toEqual(['fairy']);
    expect(speciesBySlug('magnemite').types).toEqual(['electric', 'steel']);
    for (const s of allSpecies()) for (const t of s.types) expect(TYPES).toContain(t);
  });

  it('has catch rates, growth rates and base experience', () => {
    expect(speciesBySlug('pidgey')).toMatchObject({ captureRate: 255, growthRate: 'medium-slow' });
    expect(speciesBySlug('mewtwo')).toMatchObject({ captureRate: 3, legendary: true });
    for (const s of allSpecies()) expect(s.baseExperience).toBeGreaterThan(0);
  });

  it('has the Red/Blue level-up learnsets', () => {
    const charmander = speciesBySlug('charmander').learnset;
    expect(charmander).toContainEqual({ level: 9, move: 'ember' });
    expect(charmander).toContainEqual({ level: 38, move: 'flamethrower' });
    for (const s of allSpecies()) for (const entry of s.learnset) expect(() => move(entry.move)).not.toThrow();
  });

  it('has evolutions, only into Pokémon the game knows', () => {
    expect(speciesBySlug('charmander').evolutions).toEqual([{ to: 5, kind: 'level', level: 16 }]);
    expect(speciesBySlug('pikachu').evolutions).toEqual([{ to: 26, kind: 'item', item: 'thunder-stone' }]);
    expect(speciesBySlug('kadabra').evolutions).toEqual([{ to: 65, kind: 'trade' }]);
    // Eevee: only its three Kanto evolutions (Espeon & co. come with later regions).
    expect(speciesBySlug('eevee').evolutions.map(e => e.to)).toEqual([134, 135, 136]);
  });

  it('has Red/Blue wild encounters', () => {
    const pidgey = speciesBySlug('pidgey').encounters;
    expect(pidgey.some(e => e.area === 'kanto-route-1-area' && e.method === 'walk')).toBe(true);
    expect(speciesBySlug('mewtwo').encounters.length).toBeGreaterThan(0);
  });

  it("has the starters' gift moves and Struggle", () => {
    expect(move('ember')).toMatchObject({ type: 'fire', power: 40, category: 'special' });
    expect(move('bubble')).toMatchObject({ type: 'water', category: 'special' });
    expect(move('vine-whip')).toMatchObject({ type: 'grass', category: 'physical' });
    expect(move('struggle')).toMatchObject({ type: 'normal', power: 50, category: 'physical' });
  });
});

describe('type chart (modern, 18 types)', () => {
  it('has 18 types', () => {
    expect(TYPES).toHaveLength(18);
  });

  it.each([
    ['fire', ['grass'], 2],
    ['water', ['fire'], 2],
    ['grass', ['water'], 2],
    ['fire', ['water'], 0.5],
    ['electric', ['water'], 2],
    ['psychic', ['poison'], 2],
    ['fighting', ['rock'], 2],
    ['normal', ['normal'], 1],
    ['dragon', ['fairy'], 0],
    ['fairy', ['dragon'], 2],
  ] as const)('%s → %s = ×%s', (attack, defender, multiplier) => {
    expect(effectiveness(attack, defender)).toBe(multiplier);
  });

  it('immunities are ×0', () => {
    expect(effectiveness('normal', ['ghost'])).toBe(0);
    expect(effectiveness('ghost', ['normal'])).toBe(0);
    expect(effectiveness('electric', ['ground'])).toBe(0);
    expect(effectiveness('fighting', ['ghost', 'poison'])).toBe(0);
  });

  it('two types multiply: ×4 and ×¼', () => {
    expect(effectiveness('ice', ['dragon', 'flying'])).toBe(4); // Dragonite
    expect(effectiveness('fire', ['water', 'rock'])).toBe(0.25); // Kabutops
    expect(effectiveness('rock', ['fire', 'flying'])).toBe(4); // Charizard
  });
});
