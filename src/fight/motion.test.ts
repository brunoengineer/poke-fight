// The motion input (plan.md §4.3): back, down, forward + the physical attack = the elemental special, free of PP.

import { describe, expect, it } from 'vitest';
import { ELEMENTAL_COST, PP_START } from './constants';
import { ELEMENTAL, moveLength, type ElementalShape } from './frame-data';
import { Button, type InputMask } from './input';
import { MOTION, MOTION_HISTORY, motionDone } from './motion';
import { at, fightAt, run, specialDamage, type Script } from './testing';

const { Left, Right, Down, Up, Physical, Special } = Button;

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

/** Facing right: ← ↓ → then J (on the frame forward is reached). */
const MOTION_RIGHT = sequence([Left, 1], [Down, 1], [Right | Physical, 1]);

/** Both fighters with this elemental shape, far apart (the motion's first frames walk back a little). */
function setup(distance: number, shape: ElementalShape = 'projectile', pp?: readonly [number, number]) {
  const state = fightAt(distance, pp ? { pp } : {});
  for (const f of state.fighters) f.loadout.elemental = { name: 'Test', type: 'normal', power: 40, category: 'special', shape };
  return state;
}

describe('the motion (history check)', () => {
  // Newest first: index 0 is the frame of the press.
  const history = (...oldestFirst: InputMask[]) => [...oldestFirst].reverse();

  it(`remembers ${MOTION_HISTORY} frames: ${MOTION.window} for the motion, ${MOTION.press} more to press`, () => {
    expect(MOTION).toEqual({ window: 20, press: 8 });
    expect(MOTION_HISTORY).toBe(28);
  });

  it('back, down, forward, relative to the facing', () => {
    expect(motionDone(history(Left, Down, Right), 1)).toBe(true);
    expect(motionDone(history(Right, Down, Left), -1)).toBe(true);
    expect(motionDone(history(Right, Down, Left), 1)).toBe(false);
    expect(motionDone(history(Left, Down, Right), -1)).toBe(false);
  });

  it('diagonals count as both of their directions', () => {
    expect(motionDone(history(Left, Down | Left, Down, Down | Right, Right), 1)).toBe(true);
    expect(motionDone(history(Down | Left, Right), 1)).toBe(true); // down-back is "back, down"
    expect(motionDone(history(Left, Down | Right), 1)).toBe(true); // down-forward is "down, forward"
  });

  it('needs all three, in order', () => {
    expect(motionDone(history(Left, Right), 1)).toBe(false);
    expect(motionDone(history(Down, Left, Right), 1)).toBe(false);
    expect(motionDone(history(Left, Right, Down), 1)).toBe(false);
    expect(motionDone(history(Down, Right), 1)).toBe(false);
    expect(motionDone([], 1)).toBe(false);
  });
});

describe('motion + attack: the free elemental special', () => {
  it('comes out on the frame of the press, with the PP unchanged', () => {
    const r = run(3, MOTION_RIGHT, 0, setup(200));
    expect(at(r, 2).fighters[0].action).not.toBe('attack');
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'elemental', actionFrame: 1, pp: PP_START, freeSpecial: true });
    expect(r.events).toEqual([{ type: 'special', fighter: 0, slot: 'elemental', frame: 3 }]);
  });

  it('a hit during its charge cancels it, and gives back nothing (it cost nothing)', () => {
    const r = run(30, MOTION_RIGHT, (f: number) => (f === 3 ? Physical : 0), setup(40));
    expect(r.events.some(e => e.type === 'hit' && e.defender === 0)).toBe(true);
    expect(r.frames.every(s => s.projectiles.length === 0)).toBe(true);
    expect(r.final.fighters[0].pp).toBe(PP_START);
  });

  it('works with an empty PP bar', () => {
    const r = run(40, MOTION_RIGHT, 0, setup(300, 'projectile', [0, 50]));
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'elemental', pp: 0 });
    // The same move as the button: a projectile on the 15th frame of the special.
    expect(at(r, 17).projectiles).toHaveLength(1);
    expect(at(r, 3 + moveLength(ELEMENTAL.projectile)).fighters[0].action).toBe('idle');
  });

  it('facing left, the motion is mirrored: → ↓ ←', () => {
    const p2 = sequence([Right, 1], [Down, 1], [Left | Physical, 1]);
    const r = run(3, 0, p2, setup(200));
    expect(at(r, 3).fighters[1]).toMatchObject({ action: 'elemental', pp: PP_START });
    // ← ↓ → is the motion backwards for player 2: a tackle.
    const wrong = run(3, 0, sequence([Left, 1], [Down, 1], [Right | Physical, 1]), setup(200));
    expect(at(wrong, 3).fighters[1].action).toBe('attack');
  });

  it('with diagonals: ← ↙ ↓ ↘ → J', () => {
    const r = run(6, sequence([Left, 1], [Down | Left, 1], [Down, 1], [Down | Right, 1], [Right, 1], [Right | Physical, 1]), 0, setup(200));
    expect(at(r, 6).fighters[0]).toMatchObject({ action: 'elemental', pp: PP_START });
  });

  it('does the same damage as the special button, and earns no PP when it lands', () => {
    const button = run(60, (f: number) => (f === 3 ? Special : 0), 0, setup(100));
    const motion = run(60, MOTION_RIGHT, 0, setup(100));
    const hitOf = (r: typeof motion) => r.events.find(e => e.type === 'hit');
    expect(hitOf(motion)).toMatchObject({ source: 'elemental', damage: specialDamage('elemental', setup(100)) });
    expect(hitOf(motion)!.damage).toBe(hitOf(button)!.damage);
    expect(button.final.fighters[0].pp).toBe(PP_START - ELEMENTAL_COST + ELEMENTAL.projectile.hit.ppGain);
    expect(motion.final.fighters[0].pp).toBe(PP_START);
  });

  it('a free beam earns no PP either', () => {
    const r = run(40, MOTION_RIGHT, 0, setup(100, 'beam'));
    expect(r.events.find(e => e.type === 'hit')).toMatchObject({ source: 'elemental', attacker: 0 });
    expect(r.final.fighters[0].pp).toBe(PP_START);
  });

  it('the special button still costs ¼ of the bar, even right after a motion', () => {
    const r = run(3, sequence([Left, 1], [Down, 1], [Right | Special, 1]), 0, setup(200));
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'elemental', pp: PP_START - ELEMENTAL_COST, freeSpecial: false });
  });

  it('in the air too, using the jump’s one air move', () => {
    // Jump straight up (prejump 3 frames, airborne from frame 4), then the motion in the air.
    const r = run(12, sequence([Up, 1], [0, 4], [Left, 1], [Down, 1], [Right | Physical, 1]), 0, setup(200));
    expect(at(r, 8).fighters[0]).toMatchObject({ action: 'elemental', pp: PP_START, airAttackUsed: true });
  });

  it('is buffered like any press: done during a tackle, it comes out when the tackle ends', () => {
    // Tackle on frame 1 (free again on frame 22); the motion + J on frames 18–20.
    const r = run(22, sequence([Physical, 1], [0, 16], [Left, 1], [Down, 1], [Right | Physical, 1]), 0, setup(200));
    expect(at(r, 21).fighters[0].action).toBe('attack');
    expect(at(r, 22).fighters[0]).toMatchObject({ action: 'elemental', actionFrame: 1, pp: PP_START });
  });
});

describe('the motion’s windows', () => {
  it(`back to forward in ${MOTION.window} frames works, ${MOTION.window + 1} is too slow (a tackle)`, () => {
    // Back on frame 1, down on frame 10, forward reached on frame 20 (20 frames) or 21 (21 frames), J with it.
    const inTime = run(20, sequence([Left, 1], [0, 8], [Down, 1], [0, 9], [Right | Physical, 1]), 0, setup(200));
    expect(at(inTime, 20).fighters[0]).toMatchObject({ action: 'elemental', pp: PP_START });
    const late = run(21, sequence([Left, 1], [0, 8], [Down, 1], [0, 10], [Right | Physical, 1]), 0, setup(200));
    expect(at(late, 21).fighters[0].action).toBe('attack');
  });

  it(`the attack up to ${MOTION.press} frames after forward works, ${MOTION.press + 1} is too late`, () => {
    // Forward reached on frame 3 and held; J on frame 11 (8 frames later) or 12 (9 frames later).
    const hold = (pressOn: number) => (f: number) => (f === 1 ? Left : f === 2 ? Down : Right | (f === pressOn ? Physical : 0));
    expect(at(run(11, hold(11), 0, setup(300)), 11).fighters[0].action).toBe('elemental');
    expect(at(run(12, hold(12), 0, setup(300)), 12).fighters[0].action).toBe('attack');
  });

  it('a wrong order is a tackle', () => {
    for (const steps of [
      [Down, Left, Right],
      [Left, Right, Down],
      [Right, Down, Left],
    ]) {
      const r = run(3, sequence(...steps.map((mask, i): [InputMask, number] => [mask | (i === 2 ? Physical : 0), 1])), 0, setup(200));
      expect(at(r, 3).fighters[0].action).toBe('attack');
    }
  });

  it('walking back then forward, without down, is a tackle', () => {
    const r = run(25, sequence([Left, 10], [Right, 14], [Right | Physical, 1]), 0, setup(300));
    expect(at(r, 25).fighters[0]).toMatchObject({ action: 'attack', pp: PP_START });
  });

  it('a plain attack is still a tackle', () => {
    const r = run(1, Physical, 0, setup(200));
    expect(at(r, 1).fighters[0]).toMatchObject({ action: 'attack', freeSpecial: false });
  });
});
