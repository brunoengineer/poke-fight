// Damage (official formula, no random roll) and its effects in the fight: types, immunities, speed.

import { describe, expect, it } from 'vitest';
import { speciesBySlug } from '../data/pokedex';
import { createPokemon, toFighter } from '../game/pokemon';
import { DAMAGE_SCALE, HP_UNITS } from './constants';
import { computeDamage } from './damage';
import { PHYSICAL_POWER, WALK } from './frame-data';
import { Button } from './input';
import { createFight, type AttackInfo, type FighterSetup } from './state';
import { fightAt, on, run, TACKLE_DAMAGE } from './testing';

const tackle: AttackInfo = { power: PHYSICAL_POWER, type: null, category: 'physical' };
const [a, b] = createFight().fighters;

describe('damage formula', () => {
  it('matches the official formula, scaled for the fight', () => {
    // Lv. 50, Attack = Defense: floor(floor(22 × 40 × 1) / 50) + 2 = 19 → × 0.6 × 10 = 114.
    expect(computeDamage(a, b, tackle).damage).toBe(Math.floor(19 * DAMAGE_SCALE * HP_UNITS));
    expect(TACKLE_DAMAGE).toBe(114);
  });

  it('the same hit always does the same damage (no random roll)', () => {
    expect(new Set(Array.from({ length: 20 }, () => computeDamage(a, b, tackle).damage)).size).toBe(1);
  });

  it('same-type moves do 1.5×, type matchups multiply', () => {
    const normalSpecial: AttackInfo = { power: 40, type: 'normal', category: 'special' };
    expect(computeDamage(a, b, normalSpecial).damage).toBe(Math.floor(19 * 1.5 * DAMAGE_SCALE * HP_UNITS));
    const ghost = { ...b, types: ['ghost'] };
    expect(computeDamage(a, ghost, normalSpecial)).toEqual({ damage: 0, effectiveness: 0 });
    const fighting: AttackInfo = { power: 40, type: 'fighting', category: 'physical' };
    expect(computeDamage(a, b, fighting)).toEqual({ damage: Math.floor(19 * 2 * DAMAGE_SCALE * HP_UNITS), effectiveness: 2 });
  });

  it('the tackle has no type: it even hits a Ghost, with no same-type bonus', () => {
    const ghost = { ...b, types: ['ghost'] };
    expect(computeDamage(a, ghost, tackle)).toEqual({ damage: TACKLE_DAMAGE, effectiveness: 1 });
  });

  it('physical moves use Attack/Defense, special moves Sp. Atk/Sp. Def', () => {
    const strong = { ...a, stats: { ...a.stats, atk: 200 } };
    expect(computeDamage(strong, b, tackle).damage).toBeGreaterThan(TACKLE_DAMAGE);
    const special: AttackInfo = { power: 40, type: 'fire', category: 'special' };
    expect(computeDamage(strong, b, special).damage).toBe(computeDamage(a, b, special).damage);
  });

  it('a Lv. 50 Pokémon with average stats takes about 12 tackles from an equal one', () => {
    const ivysaur = toFighter(createPokemon(speciesBySlug('ivysaur').id, 50));
    const state = createFight({ fighters: [ivysaur, ivysaur] });
    const tackles = Math.ceil(ivysaur.maxHp / computeDamage(state.fighters[0], state.fighters[1], tackle).damage);
    expect(tackles).toBeGreaterThanOrEqual(10);
    expect(tackles).toBeLessThanOrEqual(14);
  });
});

describe('types in the fight', () => {
  const ghostSetup: Partial<FighterSetup> = { types: ['ghost'] };

  it('a special that cannot touch the defender says "no effect" and does nothing', () => {
    // The default specials are Fire: use a Normal one against a Ghost.
    const state = fightAt(40, { fighters: [{}, ghostSetup] });
    state.fighters[0].loadout.elemental = { name: 'Swift', type: 'normal', power: 60, category: 'special', shape: 'projectile' };
    const r = run(40, on(Button.Special, 1), 0, state);
    expect(r.events.find(e => e.type === 'hit')).toMatchObject({ damage: 0, effectiveness: 0 });
    expect(r.final.fighters[1]).toMatchObject({ hp: state.fighters[1].hp, action: 'idle' });
  });

  it('a super effective hit says so', () => {
    const state = fightAt(40, { fighters: [{}, { types: ['grass'] }] });
    const r = run(40, on(Button.Special, 1), 0, state);
    expect(r.events.find(e => e.type === 'hit')).toMatchObject({ effectiveness: 2 });
  });
});

describe('speed in the fight', () => {
  it('a faster Pokémon walks faster', () => {
    const r = run(30, Button.Right, 0, fightAt(300, { fighters: [{ mobility: 110 }, {}] }));
    expect(r.final.fighters[0].x - fightAt(300).fighters[0].x).toBe(30 * Math.round((WALK.forward * 110) / 100));
  });
});
