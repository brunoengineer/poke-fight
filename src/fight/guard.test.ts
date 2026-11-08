// Guard (L / RB): blocks everything on the ground, from both sides.

import { describe, expect, it } from 'vitest';
import { createAdvantageTracker, trackAdvantage } from './advantage';
import { CHIP_DIVISOR, MAX_HP, PP_START } from './constants';
import { GUARD } from './frame-data';
import { Button } from './input';
import { step } from './step';
import { at, fightAt, on, run, specialDamage } from './testing';

const { Guard, Physical, Special, Right, Up, Dash } = Button;

describe('guard', () => {
  it('starts on the frame the button is pressed, and holds while it is held', () => {
    const r = run(10, Guard);
    expect(at(r, 1).fighters[0]).toMatchObject({ action: 'guard', actionFrame: 1 });
    expect(at(r, 10).fighters[0].action).toBe('guard');
  });

  it('cannot move while guarding', () => {
    const r = run(30, Guard | Right, 0, fightAt(200));
    expect(r.final.fighters[0].x).toBe(fightAt(200).fighters[0].x);
  });

  it(`letting go takes ${GUARD.release} frames before walking`, () => {
    const r = run(20, f => (f <= 10 ? Guard : Right), 0, fightAt(200));
    expect(at(r, 11).fighters[0]).toMatchObject({ action: 'guardEnd', actionFrame: 1 });
    expect(at(r, 13).fighters[0].action).toBe('guardEnd');
    expect(at(r, 14).fighters[0].action).toBe('walkForward');
  });

  it('can attack straight out of a guard', () => {
    const r = run(10, f => Guard | (f === 5 ? Physical : 0));
    expect(at(r, 5).fighters[0]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });

  it('blocks a tackle: no damage, blockstun, no PP for the attacker', () => {
    const r = run(40, on(Physical, 1), Guard, fightAt(40));
    expect(r.events).toEqual([{ type: 'block', attacker: 0, defender: 1, chip: 0, source: 'tackle', frame: 6 }]);
    expect(r.final.fighters[1].hp).toBe(MAX_HP);
    expect(r.final.fighters[0].pp).toBe(PP_START);
    expect(r.frames.some(s => s.fighters[1].action === 'blockstun')).toBe(true);
  });

  it('the tackle is -1 on block (the defender can act first)', () => {
    let state = fightAt(40);
    let tracker = createAdvantageTracker();
    for (let frame = 1; frame <= 60; frame++) {
      const result = step(state, [frame === 1 ? Physical : 0, Guard]);
      state = result.state;
      tracker = trackAdvantage(tracker, state, result.events);
    }
    expect(tracker.last).toEqual({ kind: 'block', value: -1 });
  });

  it(`specials do 1/${CHIP_DIVISOR} of their damage through a guard`, () => {
    const r = run(60, on(Special, 1), Guard, fightAt(100));
    const chip = Math.floor(specialDamage('elemental') / CHIP_DIVISOR);
    expect(r.events.find(e => e.type === 'block')).toMatchObject({ chip });
    expect(r.final.fighters[1].hp).toBe(MAX_HP - chip);
  });

  it('chip damage can finish a Pokémon', () => {
    const r = run(60, on(Special, 1), Guard, fightAt(100, { hp: [MAX_HP, 10] }));
    expect(r.final.winner).toBe(0);
  });

  it('blocks from both sides (after a dash through)', () => {
    // Player 1 dashes through the guarding opponent, then attacks from the other side.
    const r = run(60, f => (f === 1 ? Dash : f === 25 ? Physical : 0), Guard, fightAt(40));
    expect(r.events.map(e => e.type)).toEqual(['block']);
  });

  it('cannot guard in the air: a jumping fighter holding guard gets hit', () => {
    // Player 2 jumps (in the air from frame 4) and holds guard; the tackle connects on frame 6, low in the jump.
    const r = run(30, on(Physical, 1), f => (f <= 3 ? Up : Guard), fightAt(40));
    expect(at(r, 5).fighters[1].action).toBe('jump');
    expect(r.events.find(e => e.type === 'hit' || e.type === 'block')).toMatchObject({ type: 'hit', frame: 6, air: true });
  });
});

// The tackle blocked by a defender who keeps guarding: the defender never loses HP.
describe('guard against a series of tackles', () => {
  it('takes no damage', () => {
    const r = run(300, f => (f % 25 === 1 ? Physical : 0) | Right, Guard, fightAt(40));
    expect(r.events.every(e => e.type === 'block')).toBe(true);
    expect(r.final.fighters[1].hp).toBe(MAX_HP);
  });
});
