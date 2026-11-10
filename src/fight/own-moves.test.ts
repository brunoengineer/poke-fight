// Moves of their own (plan.md §4.9): a famous Pokémon's signature move (back, down, forward + attack: free, in a big
// special's form, hitting like an elemental special) and a legendary's move (down, down + attack: all the PP, a big
// special scaled by how full the bar was).

import { describe, expect, it } from 'vitest';
import { PP_MAX, PP_START } from './constants';
import { bigDamage, computeDamage } from './damage';
import { BIG, LEGEND_MIN, signatureMove } from './frame-data';
import { Button, type InputMask } from './input';
import { doubleDownDone, MOTION } from './motion';
import { createFight, type FightState, type Loadout } from './state';
import { at, fightAt, run, type Script } from './testing';

const { Left, Right, Down, Physical } = Button;

/** Inputs held for a number of frames each, one after the other from frame 1 (then nothing). */
function sequence(...steps: [InputMask, number][]): Script {
  return (frame: number) => {
    let end = 0;
    for (const [mask, frames] of steps) {
      end += frames;
      if (frame <= end) return mask;
    }
    return 0;
  };
}

/** Facing right: ← ↓ → + J on frame 3. */
const MOTION_RIGHT = sequence([Left, 1], [Down, 1], [Right | Physical, 1]);
/** ↓, let go, ↓ + J on frame 3. */
const DOUBLE_DOWN = sequence([Down, 1], [0, 1], [Down | Physical, 1]);

const SIGNATURE: NonNullable<Loadout['signature']> = { name: 'Thunder', type: 'normal', power: 90, category: 'special', shape: 'beam' };
const LEGEND: NonNullable<Loadout['legend']> = { attack: 'nova', type: 'normal', category: 'special', shape: 'burst' };

function setup(distance: number, own: Partial<Loadout>, pp: number = PP_START): FightState {
  const state = fightAt(distance, { pp: [pp, 50] });
  state.fighters[0].loadout = { ...state.fighters[0].loadout, ...own };
  return state;
}

describe('the down, down motion', () => {
  const history = (...frames: InputMask[]) => frames.slice().reverse();
  it('is two separate downs within the window, the attack soon after the second', () => {
    expect(doubleDownDone(history(Down, 0, Down))).toBe(true);
    expect(doubleDownDone(history(Down, Down, 0, 0, Down, Down))).toBe(true);
    // Held down (one press) is not two.
    expect(doubleDownDone(history(Down, Down, Down))).toBe(false);
    // The second down too long before the attack.
    expect(doubleDownDone(history(Down, 0, Down, ...Array(MOTION.press + 1).fill(0)))).toBe(false);
    // The two downs too far apart.
    expect(doubleDownDone(history(Down, ...Array(MOTION.window).fill(0), Down))).toBe(false);
  });
});

describe('signature moves', () => {
  it('back, down, forward + attack: the signature, free, in its form (a big action), with its own timing', () => {
    const r = run(4, MOTION_RIGHT, 0, setup(200, { signature: SIGNATURE }));
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'big', bigKind: 'signature', pp: PP_START, freeSpecial: true });
    expect(at(r, 3).fighters[0].actionLength).toBe(BIG.beam.startup + BIG.beam.active + BIG.beam.recovery);
    expect(r.events.find(e => e.type === 'special')).toMatchObject({ slot: 'big', kind: 'signature' });
  });

  it('hits like an elemental special (its power, no knockdown), and earns no PP', () => {
    const state = setup(200, { signature: SIGNATURE });
    const r = run(60, MOTION_RIGHT, 0, state);
    const hit = r.events.find(e => e.type === 'hit');
    const expected = computeDamage(state.fighters[0], state.fighters[1], { power: 90, type: 'normal', category: 'special' }).damage;
    expect(hit).toMatchObject({ attacker: 0, damage: expected, big: false });
    expect(r.final.fighters[0].pp).toBe(PP_START);
    expect(signatureMove('beam').hit.launch).toBeUndefined();
  });

  it('a Pokémon without one gets the free elemental special, as before', () => {
    const r = run(4, MOTION_RIGHT, 0, setup(200, {}));
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'elemental', freeSpecial: true });
  });
});

describe('legendary moves', () => {
  it('down, down + attack: all the PP, any amount above 0', () => {
    const r = run(4, DOUBLE_DOWN, 0, setup(200, { legend: LEGEND }, 30));
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'big', bigKind: 'legend', pp: 0, legendPaid: 30 });
  });

  it('with no PP, or without a legendary move, the press is a tackle', () => {
    expect(at(run(4, DOUBLE_DOWN, 0, setup(200, { legend: LEGEND }, 0)), 3).fighters[0].action).toBe('attack');
    expect(at(run(4, DOUBLE_DOWN, 0, setup(200, {}, PP_MAX)), 3).fighters[0].action).toBe('attack');
  });

  it('a full bar hits like a big special; less, in proportion (at least a fifth of it)', () => {
    const damageAt = (pp: number) => {
      const state = setup(60, { legend: LEGEND }, pp);
      const r = run(80, DOUBLE_DOWN, 0, state);
      return (r.events.find(e => e.type === 'hit') as { damage: number } | undefined)?.damage ?? 0;
    };
    const ref = setup(60, { legend: LEGEND }, PP_MAX);
    const [a, d] = ref.fighters;
    const full = bigDamage(a, d, { power: 100, type: 'normal', category: 'special' }, d.maxHp).damage;
    expect(damageAt(PP_MAX)).toBe(full);
    expect(damageAt(50)).toBe(bigDamage(a, d, { power: 100, type: 'normal', category: 'special', part: 0.5 }, d.maxHp).damage);
    expect(damageAt(5)).toBe(bigDamage(a, d, { power: 100, type: 'normal', category: 'special', part: LEGEND_MIN }, d.maxHp).damage);
  });

  it('a hit during its charge gives back what it took', () => {
    const state = setup(40, { legend: LEGEND }, 70);
    const r = run(60, DOUBLE_DOWN, (f: number) => (f === 4 ? Physical : 0), state);
    expect(at(r, 3).fighters[0].pp).toBe(0);
    expect(r.events.some(e => e.type === 'hit' && e.defender === 0)).toBe(true);
    expect(r.final.fighters[0].pp).toBeGreaterThanOrEqual(70);
  });
});

describe('the fighters', () => {
  it('a plain fight has neither (nothing changes for the others)', () => {
    const f = createFight().fighters[0];
    expect(f.loadout.signature).toBeUndefined();
    expect(f.loadout.legend).toBeUndefined();
    expect(f.bigKind).toBe('big');
  });
});
