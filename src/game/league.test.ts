// The Pokémon League: the Elite Four, the Champion (the rival), and the next-region hook.

import { describe, expect, it } from 'vitest';
import { nextRegion, REGIONS } from '../data/regions';
import { species } from '../data/pokedex';
import { KANTO } from '../data/regions/kanto';

const ELITE_FOUR = KANTO.league.eliteFour;
const GYMS = KANTO.gyms;
const LEAGUE_CITY = KANTO.league.city;
import { canEnterLeague, LEAGUE_SIZE, leagueOpponent, leaguePrize } from './league';

const rival = (starterId: number) => ({ name: 'Ren', starterId });
const names = (stage: number, starterId = 7) => leagueOpponent(KANTO, stage, rival(starterId)).team.map(p => `${species(p.speciesId).name} ${p.level}`);

describe('Pokémon League', () => {
  it('is the Elite Four, then the Champion, at Indigo Plateau', () => {
    expect(LEAGUE_SIZE).toBe(5);
    expect(LEAGUE_CITY).toBe('indigo');
    expect(ELITE_FOUR.map(m => [m.name, m.type])).toEqual([
      ['Lorelei', 'ice'],
      ['Bruno', 'fighting'],
      ['Agatha', 'ghost'],
      ['Lance', 'dragon'],
    ]);
  });

  it('the Elite Four have their Red/Blue teams, and their type is in them', () => {
    expect(names(0)).toEqual(['Dewgong 54', 'Cloyster 53', 'Slowbro 54', 'Jynx 56', 'Lapras 56']);
    expect(names(3)).toEqual(['Gyarados 58', 'Dragonair 56', 'Dragonair 56', 'Aerodactyl 60', 'Dragonite 62']);
    for (let stage = 0; stage < 4; stage++) {
      const opponent = leagueOpponent(KANTO, stage, rival(7));
      expect(opponent.team.some(p => species(p.speciesId).types.includes(opponent.type!)), opponent.name).toBe(true);
    }
  });

  it('the Champion is the rival, with the Red/Blue team of the starter they took', () => {
    const champion = leagueOpponent(KANTO, 4, rival(7));
    expect(champion).toMatchObject({ kind: 'champion', name: 'Ren', type: null });
    expect(names(4, 7).at(-1)).toBe('Blastoise 65');
    expect(names(4, 1).at(-1)).toBe('Venusaur 65');
    expect(names(4, 4).at(-1)).toBe('Charizard 65');
    expect(names(4, 7).slice(0, 3)).toEqual(['Pidgeot 61', 'Alakazam 59', 'Rhydon 61']);
  });

  it('all five are hard CPUs', () => {
    for (let stage = 0; stage < LEAGUE_SIZE; stage++) expect(leagueOpponent(KANTO, stage, rival(7)).ai.difficulty).toBe('hard');
  });

  it('pays 99 × the strongest level (Lance ₽6138, the Champion ₽6435)', () => {
    expect(leaguePrize(leagueOpponent(KANTO, 3, rival(7)).team)).toBe(6138);
    expect(leaguePrize(leagueOpponent(KANTO, 4, rival(7)).team)).toBe(6435);
  });

  it('needs all 8 badges', () => {
    const badges = GYMS.map(g => g.badge);
    expect(canEnterLeague(badges.slice(0, 7))).toBe(false);
    expect(canEnterLeague(badges)).toBe(true);
  });

  it('there is no sixth battle', () => {
    expect(() => leagueOpponent(KANTO, 5, rival(7))).toThrow();
  });
});

describe('regions', () => {
  it('Kanto comes first; after its League comes the next region that exists', () => {
    expect(REGIONS[0].id).toBe('kanto');
    expect(nextRegion('kanto')).toBe(REGIONS[1]?.id ?? null);
  });
});
