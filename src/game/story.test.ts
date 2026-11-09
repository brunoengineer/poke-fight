// The Battle field's trainers: three of the city's own Pokémon, picked at random, at the party's level.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { city, region } from '../data/regions';
import { KANTO } from '../data/regions/kanto';
import { createRng } from '../engine/rng';
import { createPokemon } from './pokemon';
import { cityPokemon, TRAINING_TEAM, trainingOpponents } from './story';

const party = [createPokemon(4, 12), createPokemon(16, 18)];
const id = (slug: string) => speciesBySlug(slug).id;

describe('Battle field trainers', () => {
  it("bring three different Pokémon of the city's own grounds, at the party's average level", () => {
    const pewter = city('pewter');
    const pool = cityPokemon(pewter);
    for (let seed = 1; seed <= 20; seed++) {
      const team = trainingOpponents(KANTO, pewter, party, createRng(seed));
      expect(team).toHaveLength(TRAINING_TEAM);
      expect(new Set(team.map(p => p.speciesId)).size).toBe(TRAINING_TEAM);
      for (const p of team) {
        expect(pool).toContain(p.speciesId);
        expect(p.level).toBe(15);
      }
    }
  });

  it('change from battle to battle, and from city to city', () => {
    const rng = createRng(7);
    const teams = Array.from({ length: 10 }, () => trainingOpponents(KANTO, city('pewter'), party, rng).map(p => p.speciesId).join());
    expect(new Set(teams).size).toBeGreaterThan(1);
    // Cerulean's water brings its fish; Pewter has none.
    expect(cityPokemon(city('cerulean'))).toContain(id('goldeen'));
    expect(cityPokemon(city('pewter'))).not.toContain(id('goldeen'));
  });

  it("every city of every region has Pokémon for them; a place without any falls back to the region's common ones", () => {
    for (const r of ['kanto', 'johto', 'hoenn', 'sinnoh'] as const) {
      for (const c of region(r).cities) expect(cityPokemon(c).length, c.id).toBeGreaterThan(0);
    }
    const empty = { ...city('pewter'), id: 'nowhere', hunts: {}, safari: undefined };
    expect(trainingOpponents(KANTO, empty, party, createRng(1)).map(p => p.speciesId)).toEqual(KANTO.training.map(id));
  });
});
