// The Training Dojo: leaving a Pokémon, a level per battle, taking it back for the fee.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { DOJO_FEE, leaveAtDojo, takeBack, trained, trainOnce, type Dojo } from './dojo';
import { createPokemon, maxHpOf } from './pokemon';

const id = (slug: string) => speciesBySlug(slug).id;
const battles = (dojo: Dojo, n: number) => Array.from({ length: n }).reduce<Dojo>(d => trainOnce(d), dojo);

describe('the Training Dojo', () => {
  it('a party Pokémon is left healed; the party keeps at least one, and the dojo holds one at a time', () => {
    const hurt = { ...createPokemon(id('pikachu'), 12), hp: 5 };
    const party = [createPokemon(id('charmander'), 15), hurt];
    const { party: left, dojo } = leaveAtDojo(party, 1, null);
    expect(left).toEqual([party[0]]);
    expect(dojo).toEqual({ pokemon: { ...hurt, hp: maxHpOf(hurt) }, battles: 0 });
    expect(() => leaveAtDojo(left, 0, null)).toThrow();
    expect(() => leaveAtDojo(party, 0, dojo)).toThrow();
  });

  it('one level per battle, with the moves of each level; full HP when it comes back', () => {
    const { dojo } = leaveAtDojo([createPokemon(id('charmander'), 1), createPokemon(id('pikachu'), 12)], 1, null);
    expect(trained(dojo).pokemon.level).toBe(12);
    const after = trained(battles(dojo, 14));
    expect(after.pokemon.level).toBe(26);
    // HeartGold/SoulSilver, Pikachu's list and Pichu's: Quick Attack 13, Sweet Kiss 13, Double Team 18, Nasty Plot 18,
    // Slam 21, Thunderbolt 26.
    expect(after.levelUps.flatMap(l => l.moves)).toEqual(['quick-attack', 'sweet-kiss', 'double-team', 'nasty-plot', 'slam', 'thunderbolt']);
    expect(after.pokemon.hp).toBe(maxHpOf(after.pokemon));
  });

  it('never past Lv. 100: the battles stop counting there', () => {
    const { dojo } = leaveAtDojo([createPokemon(id('charmander'), 5), createPokemon(id('pikachu'), 97)], 1, null);
    const long = battles(dojo, 10);
    expect(long.battles).toBe(3);
    expect(trained(long).pokemon.level).toBe(100);
  });

  it('taking it back costs the fee: to the party, or to the box when the party is full', () => {
    const { party, dojo } = leaveAtDojo([createPokemon(id('charmander'), 15), createPokemon(id('pikachu'), 12)], 1, null);
    const trainedDojo = battles(dojo, 3);
    expect(takeBack(DOJO_FEE - 1, party, [], trainedDojo)).toEqual({ ok: false, reason: 'money' });
    expect(takeBack(5000, party, [], null)).toEqual({ ok: false, reason: 'empty' });
    const back = takeBack(5000, party, [], trainedDojo);
    expect(back).toMatchObject({ ok: true, money: 5000 - DOJO_FEE, where: 'party', pokemon: { speciesId: id('pikachu'), level: 15 } });
    if (!back.ok) return;
    expect(back.party.map(p => p.level)).toEqual([15, 15]);
    const full = Array.from({ length: 6 }, () => createPokemon(id('rattata'), 10));
    const toBox = takeBack(DOJO_FEE, full, [], trainedDojo);
    expect(toBox).toMatchObject({ ok: true, money: 0, where: 'box' });
    if (toBox.ok) expect([toBox.party.length, toBox.box.length]).toEqual([6, 1]);
  });

  it('a Pokémon with no damaging move that learns one in training gets it as its specials', () => {
    const magikarp = createPokemon(id('magikarp'), 14);
    const { dojo } = leaveAtDojo([createPokemon(id('pikachu'), 12), magikarp], 1, null);
    expect(trained(trainOnce(dojo)).pokemon.specials).toEqual({ elemental: 'tackle', big: 'tackle' });
  });
});
