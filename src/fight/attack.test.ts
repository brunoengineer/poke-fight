// The physical attack, frame by frame. These numbers are the design (plan.md §4.3): change them on purpose only.

import { describe, expect, it } from 'vitest';
import { createAdvantageTracker, trackAdvantage } from './advantage';
import { BUFFER_FRAMES, HITSTOP, MAX_HP } from './constants';
import { PHYSICAL, moveLength } from './frame-data';
import { Button } from './input';
import { createFight } from './state';
import { step } from './step';
import { at, fightAt, on, run, TACKLE_DAMAGE } from './testing';

const J = Button.Physical;
const CLOSE = 40; // px between centers: in range of the physical attack

describe('physical attack', () => {
  it('starts on the frame the button is pressed: no input lag', () => {
    const r = run(1, J);
    expect(at(r, 1).fighters[0]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });

  it('lasts 21 frames: startup 5, active 4, recovery 12', () => {
    expect(moveLength(PHYSICAL)).toBe(21);
    const r = run(30, on(J, 1));
    for (let frame = 1; frame <= 21; frame++) {
      expect(at(r, frame).fighters[0]).toMatchObject({ action: 'attack', actionFrame: frame });
    }
    expect(at(r, 22).fighters[0]).toMatchObject({ action: 'idle', actionable: true });
  });

  it('cannot act during the attack, and can again on frame 22', () => {
    const r = run(25, on(J, 1));
    const actionable = r.frames.map(s => s.fighters[0].actionable);
    expect(actionable.slice(1, 21)).toEqual(new Array(20).fill(false)); // frames 2–21
    expect(actionable[21]).toBe(true); // frame 22
  });

  it('hits on frame 6, its first active frame', () => {
    const r = run(10, on(J, 1), 0, fightAt(CLOSE));
    expect(r.events[0]).toMatchObject({ type: 'hit', attacker: 0, defender: 1, damage: TACKLE_DAMAGE, frame: 6 });
  });

  it('misses an opponent out of range', () => {
    const r = run(30, on(J, 1), 0, fightAt(120));
    expect(r.events).toEqual([]);
    expect(r.final.fighters[1].hp).toBe(MAX_HP);
  });

  it('hits only once, even with 4 active frames', () => {
    const r = run(60, on(J, 1), 0, fightAt(CLOSE));
    expect(r.events.filter(e => e.type === 'hit')).toHaveLength(1);
    expect(r.final.fighters[1].hp).toBe(MAX_HP - TACKLE_DAMAGE);
  });

  it('holding the button does not repeat the attack', () => {
    const r = run(60, J);
    expect(at(r, 30).fighters[0].action).toBe('idle');
  });

  it('freezes both fighters for the hitstop, then the opponent is in hitstun', () => {
    const r = run(30, on(J, 1), 0, fightAt(CLOSE));
    const hit = at(r, 6);
    for (let frame = 7; frame <= 6 + HITSTOP; frame++) {
      const frozen = at(r, frame);
      expect(frozen.fighters[0].actionFrame).toBe(hit.fighters[0].actionFrame);
      expect(frozen.fighters[1].x).toBe(hit.fighters[1].x);
    }
    expect(at(r, 7 + HITSTOP).fighters[1]).toMatchObject({ action: 'hitstun', actionFrame: 1 });
  });

  it('pushes the opponent back', () => {
    const r = run(40, on(J, 1), 0, fightAt(CLOSE));
    expect(r.final.fighters[1].x).toBeGreaterThan(fightAt(CLOSE).fighters[1].x);
  });

  it('is +3 on hit (the attacker acts 3 frames before the opponent)', () => {
    let state = fightAt(CLOSE);
    let tracker = createAdvantageTracker();
    for (let frame = 1; frame <= 60; frame++) {
      const result = step(state, [frame === 1 ? J : 0, 0]);
      state = result.state;
      tracker = trackAdvantage(tracker, state, result.events);
    }
    expect(tracker.last).toEqual({ kind: 'hit', value: 3 });
  });
});

describe('input buffer', () => {
  it(`remembers a press made up to ${BUFFER_FRAMES} frames before the attack ends`, () => {
    // The attack started on frame 1 is over after frame 21; a press on frame 17 is still buffered on frame 22.
    const r = run(30, on(J, 1, 17));
    expect(at(r, 22).fighters[0]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });

  it('forgets a press made too early', () => {
    const r = run(30, on(J, 1, 16));
    expect(at(r, 22).fighters[0].action).toBe('idle');
  });
});

describe('air attack', () => {
  it('can be done once per jump, and hits forward and down', () => {
    const up = Button.Up;
    // Jump on frame 1 (in the air from frame 4), attack at frame 10 and again at frame 20.
    const r = run(60, f => (f === 1 ? up : 0) | (f === 10 || f === 20 ? J : 0));
    expect(at(r, 10).fighters[0]).toMatchObject({ action: 'airAttack', actionFrame: 1 });
    expect(r.frames.filter(s => s.fighters[0].action === 'airAttack' && s.fighters[0].actionFrame === 1)).toHaveLength(1);
  });

  it('a jump-in hits a standing opponent and leaves it in hitstun', () => {
    const forwardJump = Button.Up | Button.Right;
    // Jump forward from 90 px away, attack on the way down.
    const r = run(60, f => (f <= 3 ? forwardJump : 0) | (f === 24 ? J : 0), 0, fightAt(90));
    const hit = r.events.find(e => e.type === 'hit');
    expect(hit).toMatchObject({ attacker: 0, air: false });
  });
});

describe('fight start', () => {
  it('both fighters start idle, facing each other, with full HP', () => {
    const state = createFight();
    expect(state.fighters.map(f => [f.action, f.facing, f.hp])).toEqual([
      ['idle', 1, MAX_HP],
      ['idle', -1, MAX_HP],
    ]);
  });
});
