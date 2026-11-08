// Gyms, badges, evolution items and the Safari Zone.

import { describe, expect, it } from 'vitest';
import { species, speciesBySlug } from '../data/pokedex';
import { city, GYMS, isUnlocked, KANTO } from '../data/regions/kanto';
import { tableForAreas } from './encounters';
import { BADGE_COUNT, canChallenge, gymTeam, leaderPrize } from './gym';
import { createPokemon } from './pokemon';
import { itemEvolution } from './progress';

const id = (slug: string) => speciesBySlug(slug).id;

describe('gyms', () => {
  it('8 gyms, in the Red/Blue order, ending in Viridian City', () => {
    expect(BADGE_COUNT).toBe(8);
    expect(GYMS.map(g => g.city)).toEqual(['pewter', 'cerulean', 'vermilion', 'celadon', 'fuchsia', 'saffron', 'cinnabar', 'viridian']);
    expect(GYMS.map(g => g.badges)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(GYMS.map(g => g.badge)).size).toBe(8);
  });

  it('every gym city can be reached by the time its gym can be challenged', () => {
    for (const g of GYMS) expect(isUnlocked(city(g.city), g.badges), g.city).toBe(true);
  });

  it('teams are real Pokémon at the Red/Blue levels, with the leader type among them', () => {
    const brock = gymTeam(GYMS[0]);
    expect(brock.map(p => [species(p.speciesId).name, p.level])).toEqual([
      ['Geodude', 12],
      ['Onix', 14],
    ]);
    for (const g of GYMS) {
      const team = gymTeam(g);
      expect(team.length).toBeGreaterThanOrEqual(2);
      expect(team.some(p => species(p.speciesId).types.includes(g.type)), g.leader).toBe(true);
    }
  });

  it('leaders pay 99 × their strongest Pokémon’s level (Brock: ₽1386)', () => {
    expect(leaderPrize(GYMS[0])).toBe(1386);
    expect(leaderPrize(GYMS[7])).toBe(4950);
  });

  it('a gym can be challenged with enough badges, and only until it is beaten', () => {
    const [brock, misty] = GYMS;
    expect(canChallenge(brock, [])).toBe(true);
    expect(canChallenge(misty, [])).toBe(false);
    expect(canChallenge(misty, ['boulder'])).toBe(true);
    expect(canChallenge(brock, ['boulder'])).toBe(false);
    expect(canChallenge(GYMS[7], ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh'])).toBe(false);
  });

  it('each badge opens more of Kanto', () => {
    const open = (badges: number) => KANTO.filter(c => isUnlocked(c, badges)).length;
    expect([0, 1, 2, 3, 8].map(open)).toEqual([3, 4, 5, 7, 11]);
  });
});

describe('evolution items', () => {
  const at = (slug: string, level = 30) => createPokemon(id(slug), level);

  it('stones evolve the Pokémon that use them', () => {
    expect(itemEvolution(at('pikachu'), 'thunder-stone')).toMatchObject({ to: id('raichu') });
    expect(itemEvolution(at('eevee'), 'water-stone')).toMatchObject({ to: id('vaporeon') });
    expect(itemEvolution(at('eevee'), 'fire-stone')).toMatchObject({ to: id('flareon') });
    expect(itemEvolution(at('clefairy'), 'moon-stone')).toMatchObject({ to: id('clefable') });
    expect(itemEvolution(at('pikachu'), 'fire-stone')).toBeNull();
    expect(itemEvolution(at('charmander'), 'fire-stone')).toBeNull();
  });

  it('the Link Cable evolves trade evolutions (decided default)', () => {
    for (const [from, to] of [['kadabra', 'alakazam'], ['machoke', 'machamp'], ['graveler', 'golem'], ['haunter', 'gengar']]) {
      expect(itemEvolution(at(from), 'link-cable')).toMatchObject({ to: id(to) });
    }
    expect(itemEvolution(at('pikachu'), 'link-cable')).toBeNull();
  });

  it('a fainted Pokémon cannot evolve', () => {
    expect(itemEvolution({ ...at('pikachu'), hp: 0 }, 'thunder-stone')).toBeNull();
  });
});

describe('Safari Zone', () => {
  it('is in Fuchsia, with its rare Red/Blue Pokémon', () => {
    const table = tableForAreas(city('fuchsia').safari ?? [], 'walk');
    const found = new Set(table.map(e => species(e.speciesId).slug));
    for (const slug of ['chansey', 'kangaskhan', 'tauros']) expect(found, slug).toContain(slug);
    expect(KANTO.filter(c => c.safari).map(c => c.id)).toEqual(['fuchsia']);
  });
});
