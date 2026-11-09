// The big special's damage (plan.md §4.4, decided after milestone 13): it spends the whole PP bar, so it hits like
// it: about half the HP bar between equals, still about a fifth through a guard, and never a knockout from full HP.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { createPokemon, toFighter } from '../game/pokemon';
import { BOSS_HP_MULTIPLIER, makeBoss } from './boss';
import { PP_MAX } from './constants';
import { BIG_DAMAGE, bigDamage, computeDamage } from './damage';
import { Button } from './input';
import { createFight, type FightState } from './state';
import { between, fightAt, on, run } from './testing';

const { Big, Guard } = Button;
const member = (slug: string, level = 50) => toFighter(createPokemon(speciesBySlug(slug).id, level));

/** Two real Pokémon facing each other, player 1 with a full PP bar. */
function duel(a: string, b: string, levels: [number, number] = [50, 50]): FightState {
  const state = createFight({ fighters: [member(a, levels[0]), member(b, levels[1])], pp: [PP_MAX, 50], x: [200 * 256, 300 * 256] });
  return state;
}

const bigOf = (state: FightState) => {
  const [a, d] = state.fighters;
  const { power, type, category } = a.loadout.big;
  return bigDamage(a, d, { power, type, category }, d.maxHp);
};

describe('the big special', () => {
  it('between equals (the test fighters: same level, all stats 100), a same-type hit takes about half the bar', () => {
    const state = fightAt(200, { pp: [PP_MAX, 50] });
    const own = state.fighters[0].types[0];
    state.fighters[0].loadout.big = { name: 'Test', type: own, power: 100, category: 'special', shape: 'beam' };
    state.fighters[1].types = ['normal'];
    if (own === 'normal' || own === 'fighting') state.fighters[1].types = ['water'];
    const { damage, effectiveness } = bigOf(state);
    expect(effectiveness).toBe(1);
    expect(damage / state.fighters[1].maxHp).toBeCloseTo(BIG_DAMAGE.share * BIG_DAMAGE.stab, 2);
  });

  it('hurts far more than the elemental special (with the very same move)', () => {
    const state = duel('charmeleon', 'charmeleon', [30, 30]);
    const [a, d] = state.fighters;
    const elemental = computeDamage(a, d, { power: a.loadout.elemental.power, type: a.loadout.elemental.type, category: a.loadout.elemental.category }).damage;
    expect(bigOf(state).damage).toBeGreaterThan(2 * elemental);
  });

  it('types still count: super effective more, resisted less, never above 75%, nothing against an immune type', () => {
    // The same pair, only the move's type changes (Charizard is Fire/Flying).
    const share = (type: string) => {
      const state = duel('snorlax', 'charizard');
      state.fighters[0].loadout.big = { name: 'Test', type, power: 100, category: 'special', shape: 'beam' };
      return bigOf(state).damage / state.fighters[1].maxHp;
    };
    expect(share('rock')).toBeGreaterThan(share('normal')); // ×4
    expect(share('water')).toBeGreaterThan(share('normal')); // ×2
    expect(share('grass')).toBeLessThan(share('normal')); // ×¼
    expect(share('ground')).toBe(0); // can't touch a Flying type
    const crushing = duel('golem', 'charizard', [70, 30]);
    crushing.fighters[0].loadout.big = { name: 'Rock Slide', type: 'rock', power: 75, category: 'physical', shape: 'barrage' };
    expect(bigOf(crushing).damage / crushing.fighters[1].maxHp).toBeLessThanOrEqual(BIG_DAMAGE.max + 0.001);
  });

  it('a guard keeps out all but 45% of it: about a fifth of the bar still gets through', () => {
    const plain = run(80, on(Big, 1), 0, fightAt(200, { pp: [PP_MAX, 50] }));
    const guarded = run(80, on(Big, 1), between(Guard, 1, 80), fightAt(200, { pp: [PP_MAX, 50] }));
    const hit = plain.events.find(e => e.type === 'hit');
    const block = guarded.events.find(e => e.type === 'block');
    expect(hit && block && hit.type === 'hit' && block.type === 'block').toBe(true);
    if (hit?.type === 'hit' && block?.type === 'block') {
      expect(block.chip).toBe(Math.floor(hit.damage * BIG_DAMAGE.guardKeeps));
      expect(block.chip / 1000).toBeGreaterThanOrEqual(0.19);
    }
  });

  it('is not scaled down at the end of a combo', () => {
    // The opponent is already 4 hits into a combo (a long hitstun) when the big special lands.
    const state = fightAt(200, { pp: [PP_MAX, 50] });
    state.fighters[0].loadout.big = { name: 'Test', type: 'normal', power: 100, category: 'special', shape: 'beam' };
    Object.assign(state.fighters[1], { action: 'hitstun', actionFrame: 1, actionLength: 100, actionable: false, combo: 4 });
    const fresh = bigOf(state).damage;
    const r = run(60, on(Big, 1), 0, state);
    const hit = r.events.find(e => e.type === 'hit');
    expect(hit).toMatchObject({ source: 'big', combo: 5, damage: fresh });
  });

  it("against a legendary boss it counts the boss's own HP, not its bar four times as long", () => {
    const state = createFight({ fighters: [member('charizard'), makeBoss(member('mewtwo'), ['slash'])], pp: [PP_MAX, 50] });
    const [a, d] = state.fighters;
    const { power, type, category } = a.loadout.big;
    const onBoss = bigDamage(a, d, { power, type, category }, d.maxHp / BOSS_HP_MULTIPLIER).damage;
    expect(onBoss / d.maxHp).toBeLessThan(0.2);
  });
});
