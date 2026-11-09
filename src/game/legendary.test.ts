// The Legendary Sanctuary's rules: four times the HP, its boss attacks, a Master Ball only, XP for the whole party.

import { describe, expect, it } from 'vitest';
import { species, speciesBySlug } from '../data/pokedex';
import { KANTO } from '../data/regions/kanto';
import { BALLS } from '../data/items';
import { createBattle } from '../fight/battle';
import { afterBattle } from './after-battle';
import { canThrowAt, LEGENDARY_HP, legendaryFighter, legendaryPokemon } from './legendary';
import { createPokemon, maxHpOf, toFighter } from './pokemon';
import { LEGENDARY_XP } from './rewards';
import { xpForDefeating } from './xp';

const mewtwo = KANTO.sanctuary.legendaries.find(l => l.species === 'mewtwo')!;

describe('a legendary', () => {
  it('fights with four times its HP and its own boss attacks; what is caught is a normal Pokémon', () => {
    const fighter = legendaryFighter(mewtwo);
    const pokemon = legendaryPokemon(mewtwo);
    expect(fighter.maxHp).toBe(maxHpOf(pokemon) * LEGENDARY_HP);
    expect(fighter.hp).toBe(fighter.maxHp);
    expect((fighter as { boss?: { attacks: string[] } }).boss?.attacks).toEqual(mewtwo.attacks);
    expect(pokemon).toMatchObject({ speciesId: speciesBySlug('mewtwo').id, level: mewtwo.level, ivs: { atk: 31, spe: 31 } });
    expect(pokemon.hp).toBe(maxHpOf(pokemon));
  });

  it('only a Master Ball can be thrown at it (any ball at a wild Pokémon)', () => {
    expect(BALLS.filter(ball => canThrowAt(ball, true))).toEqual(['master-ball']);
    expect(BALLS.every(ball => canThrowAt(ball, false))).toBe(true);
  });

  it('beaten, it gives every party Pokémon the full XP twice over: fainted or not, fought or not', () => {
    const party = [createPokemon(6, 60), createPokemon(25, 40), createPokemon(143, 50)];
    // Pikachu fainted; Snorlax never fought.
    party[1] = { ...party[1], hp: 0 };
    const boss = { ...toFighter(legendaryPokemon(mewtwo)), hp: 0 };
    const battle = createBattle([party.map(toFighter), [{ ...toFighter(legendaryPokemon(mewtwo)) }]]);
    const done = { ...battle, teams: [battle.teams[0].map((m, i) => ({ ...m, hp: party[i].hp })), [boss]] as typeof battle.teams };
    const { party: after, report } = afterBattle(party, done, true, true);
    const each = xpForDefeating(species(boss.speciesId!).baseExperience, mewtwo.level, true, 1) * LEGENDARY_XP;
    expect(report.lines.filter(l => l.kind === 'xp').map(l => (l.kind === 'xp' ? [l.index, l.amount] : null))).toEqual([
      [0, each],
      [1, each],
      [2, each],
    ]);
    // The fainted one leveled up but is still fainted.
    expect(after[1].level).toBeGreaterThan(40);
    expect(after[1].hp).toBe(0);
  });
});
