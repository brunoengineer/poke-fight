// XP, level ups, evolution, specials and battle rewards.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { battleStep, createBattle, type BattleState } from '../fight/battle';
import { Button } from '../fight/input';
import { afterBattle } from './after-battle';
import { createPokemon, maxHpOf, toFighter, type Pokemon } from './pokemon';
import { evolve, gainXp, heal, levelEvolution, setSpecial, specialOptions } from './progress';
import { battleXp } from './rewards';
import { levelForXp, MAX_LEVEL, xpForDefeating, xpForLevel } from './xp';

const id = (slug: string) => speciesBySlug(slug).id;
const RATES = ['fast', 'medium', 'medium-slow', 'slow', 'slow-then-very-fast', 'fast-then-very-slow'];

describe('growth curves', () => {
  it('match the official values', () => {
    // Medium slow (PokeAPI's table): Lv. 2 = 9, Lv. 5 = 135, Lv. 16 = 2,535, Lv. 100 = 1,059,860.
    expect([2, 5, 16, 100].map(level => xpForLevel('medium-slow', level))).toEqual([9, 135, 2535, 1059860]);
    expect(RATES.map(rate => xpForLevel(rate, 100))).toEqual([800000, 1000000, 1059860, 1250000, 600000, 1640000]);
    for (const rate of RATES) expect(xpForLevel(rate, 1)).toBe(0);
  });

  it('always go up, and levelForXp is their inverse', () => {
    for (const rate of RATES) {
      for (let level = 2; level <= MAX_LEVEL; level++) {
        expect(xpForLevel(rate, level)).toBeGreaterThan(xpForLevel(rate, level - 1));
        expect(levelForXp(rate, xpForLevel(rate, level))).toBe(level);
        expect(levelForXp(rate, xpForLevel(rate, level) - 1)).toBe(level - 1);
      }
    }
  });

  it('XP for a defeated Pokémon: base XP × level / 7, ×1.5 from a trainer, shared', () => {
    const pidgey = speciesBySlug('pidgey').baseExperience; // 50
    expect(xpForDefeating(pidgey, 5, false)).toBe(35);
    expect(xpForDefeating(pidgey, 5, true)).toBe(53);
    expect(xpForDefeating(pidgey, 5, false, 2)).toBe(17);
  });
});

describe('level ups', () => {
  it('can climb several levels at once and learns the moves of each one', () => {
    const charmander = createPokemon(id('charmander'), 5);
    const { pokemon, levelUps } = gainXp(charmander, xpForLevel('medium-slow', 9) - charmander.xp);
    expect(pokemon.level).toBe(9);
    expect(levelUps.map(l => l.level)).toEqual([6, 7, 8, 9]);
    expect(levelUps.at(-1)!.moves).toEqual(['ember']);
    expect(pokemon.moves).toContain('ember');
  });

  it('HP goes up with max HP: a hurt Pokémon stays hurt by the same amount', () => {
    const hurt = { ...createPokemon(id('charmander'), 5), hp: 100 };
    const { pokemon } = gainXp(hurt, 10_000);
    expect(maxHpOf(pokemon) - pokemon.hp).toBe(maxHpOf(hurt) - 100);
  });

  it('a fainted Pokémon gets no XP; nothing goes past Lv. 100', () => {
    const fainted = { ...createPokemon(id('charmander'), 5), hp: 0 };
    expect(gainXp(fainted, 1000).pokemon).toEqual(fainted);
    expect(gainXp(createPokemon(id('pikachu'), 99), 10_000_000).pokemon.level).toBe(100);
  });

  it('never changes the Pokémon it was given', () => {
    const charmander = createPokemon(id('charmander'), 5);
    const copy = structuredClone(charmander);
    gainXp(charmander, 5000);
    expect(charmander).toEqual(copy);
  });
});

describe('evolution', () => {
  it('a Pokémon at its evolution level is ready to evolve', () => {
    expect(levelEvolution(createPokemon(id('charmander'), 15))).toBeNull();
    expect(levelEvolution(createPokemon(id('charmander'), 16))).toMatchObject({ to: id('charmeleon') });
    // Trade and stone evolutions come later.
    expect(levelEvolution(createPokemon(id('kadabra'), 50))).toBeNull();
    expect(levelEvolution({ ...createPokemon(id('charmander'), 16), hp: 0 })).toBeNull();
  });

  it('evolving keeps level, XP, moves and specials, and raises HP with the new stats', () => {
    const charmander = { ...createPokemon(id('charmander'), 16, { gifts: ['ember'] }), hp: 200 };
    const { pokemon } = evolve(charmander, id('charmeleon'));
    expect(pokemon).toMatchObject({ speciesId: id('charmeleon'), level: 16, xp: charmander.xp, specials: charmander.specials });
    expect(pokemon.moves).toEqual(expect.arrayContaining(charmander.moves));
    expect(maxHpOf(pokemon) - pokemon.hp).toBe(maxHpOf(charmander) - 200);
  });
});

describe('specials', () => {
  it('only known damaging moves can be specials', () => {
    const charmeleon = createPokemon(id('charmeleon'), 30);
    expect(specialOptions(charmeleon)).toEqual(['ember', 'scratch', 'rage']);
    expect(setSpecial(charmeleon, 'big', 'scratch').specials.big).toBe('scratch');
    expect(() => setSpecial(charmeleon, 'big', 'growl')).toThrow();
    expect(() => setSpecial(charmeleon, 'big', 'flamethrower')).toThrow();
  });

  it('heal restores full HP', () => {
    const hurt = { ...createPokemon(id('pikachu'), 20), hp: 3 };
    expect(heal(hurt).hp).toBe(maxHpOf(hurt));
  });
});

describe('battle rewards', () => {
  const party = () => [createPokemon(id('charmeleon'), 30), createPokemon(id('kadabra'), 30)];
  const weak = (count: number) => Array.from({ length: count }, () => ({ ...toFighter(createPokemon(id('pidgey'), 5)), hp: 10 }));

  /** Walks in and tackles every 30 frames until the battle is over. */
  function fight(battle: BattleState, frames = 5000) {
    for (let f = 1; f <= frames && battle.phase !== 'over'; f++) {
      battle = battleStep(battle, [Button.Right | (f % 30 === 0 ? Button.Physical : 0), 0]).battle;
    }
    return battle;
  }

  it('each knocked-out opponent gives XP to the Pokémon that fought it', () => {
    const battle = fight(createBattle([party().map(toFighter), weak(2)]));
    expect(battle.winner).toBe(0);
    const each = xpForDefeating(speciesBySlug('pidgey').baseExperience, 5, true);
    expect([...battleXp(battle, true)]).toEqual([[0, 2 * each]]);
  });

  it('XP is shared by everyone who fought that opponent, but not by fainted Pokémon', () => {
    const battle = createBattle([party().map(toFighter), weak(1)]);
    battle.teams[1][0].hp = 0;
    battle.fought = [[0, 1]];
    const shared = xpForDefeating(speciesBySlug('pidgey').baseExperience, 5, false, 2);
    expect([...battleXp(battle, false)]).toEqual([
      [0, shared],
      [1, shared],
    ]);
    battle.teams[0][1].hp = 0;
    expect([...battleXp(battle, false)]).toEqual([[0, xpForDefeating(speciesBySlug('pidgey').baseExperience, 5, false)]]);
  });

  it('after the battle: HP carries over, XP is added, and evolutions are offered', () => {
    // A Charmander one XP short of Lv. 16: beating anything makes it ready to evolve.
    const charmander: Pokemon = { ...createPokemon(id('charmander'), 15), xp: xpForLevel('medium-slow', 16) - 1 };
    const battle = fight(createBattle([[toFighter(charmander)], weak(1)]));
    const { party: after, report } = afterBattle([charmander], battle, true);
    expect(report.outcome).toBe('win');
    expect(report.lines[0]).toMatchObject({ kind: 'xp', index: 0 });
    expect(report.lines).toContainEqual({ kind: 'level', index: 0, level: 16 });
    expect(report.evolutions).toEqual([{ index: 0, to: id('charmeleon') }]);
    expect(after[0].hp).toBeLessThanOrEqual(maxHpOf(after[0]));
  });
});
