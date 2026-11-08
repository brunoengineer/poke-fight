// Walking, jumping, dashing, walls and push boxes.

import { describe, expect, it } from 'vitest';
import { BODY_HALF_WIDTH, STAGE_WIDTH, SUB } from './constants';
import { BACKDASH, DASH, JUMP, WALK } from './frame-data';
import { Button } from './input';
import { createFight } from './state';
import { at, between, fightAt, on, run } from './testing';

const { Left, Right, Up, Physical } = Button;
const startX = createFight().fighters[0].x;

describe('walking', () => {
  it('walks forward at 2 px and back at 1.75 px per frame', () => {
    expect(run(30, Right).final.fighters[0].x - startX).toBe(30 * WALK.forward);
    expect(startX - run(30, Left).final.fighters[0].x).toBe(30 * WALK.back);
  });

  it('left + right together is neutral', () => {
    const r = run(30, Left | Right);
    expect(r.final.fighters[0].x).toBe(startX);
    expect(r.final.fighters[0].action).toBe('idle');
  });

  it('stops at the walls', () => {
    expect(run(300, Left).final.fighters[0].x).toBe(BODY_HALF_WIDTH);
  });

  it('cannot walk through the opponent, and pushes it to the wall', () => {
    const r = run(400, Right);
    for (const state of r.frames) {
      expect(state.fighters[1].x - state.fighters[0].x).toBeGreaterThanOrEqual(BODY_HALF_WIDTH * 2);
    }
    expect(r.final.fighters[1].x).toBe(STAGE_WIDTH - BODY_HALF_WIDTH);
  });
});

describe('jumping', () => {
  it('3 frames on the ground, 36 in the air, 2 to land, then free on frame 42', () => {
    const r = run(50, on(Up, 1));
    const airborne = r.frames.map((s, i) => (s.fighters[0].y > 0 ? i + 1 : 0)).filter(Boolean);
    expect(airborne[0]).toBe(JUMP.prejump + 1);
    expect(airborne).toHaveLength(36);
    expect(at(r, 40).fighters[0]).toMatchObject({ action: 'land', actionFrame: 1, y: 0 });
    expect(at(r, 41).fighters[0].action).toBe('land');
    expect(at(r, 42).fighters[0]).toMatchObject({ action: 'idle', actionable: true });
  });

  it('reaches 85.5 px high', () => {
    const r = run(50, on(Up, 1));
    expect(Math.max(...r.frames.map(s => s.fighters[0].y)) / SUB).toBe(85.5);
  });

  it('holding up jumps again right after landing', () => {
    const r = run(50, Up);
    expect(at(r, 42).fighters[0]).toMatchObject({ action: 'prejump', actionFrame: 1 });
  });

  it('takes the direction held on the last grounded frame', () => {
    // Up alone on frame 1, then up-forward on frame 3: a forward jump.
    const r = run(50, f => (f === 1 ? Up : f <= 3 ? Up | Right : 0), 0, fightAt(300));
    const x0 = fightAt(300).fighters[0].x;
    // Moves on the 36 airborne frames and the landing frame.
    expect(r.final.fighters[0].x - x0).toBe(37 * JUMP.forwardSpeed);
  });

  it('can jump over the opponent, and both turn around after landing', () => {
    const r = run(60, between(Up | Right, 1, 3), 0, fightAt(40));
    const [p1, p2] = r.final.fighters;
    expect(p1.x).toBeGreaterThan(p2.x);
    expect([p1.facing, p2.facing]).toEqual([-1, 1]);
  });
});

describe('dashing', () => {
  it('double-tap forward dashes 70 px', () => {
    const r = run(30, on(Right, 1, 3), 0, fightAt(300));
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'dash', actionFrame: 1 });
    const x0 = at(r, 2).fighters[0].x;
    expect(at(r, 22).fighters[0].x - x0).toBe(DASH.moving * DASH.speed);
  });

  it('taps too far apart just walk', () => {
    const r = run(30, on(Right, 1, 14), 0, fightAt(300));
    expect(at(r, 14).fighters[0].action).toBe('walkForward');
  });

  it('double-tap back is a back dash', () => {
    const r = run(30, on(Left, 1, 3), 0, fightAt(300));
    expect(at(r, 3).fighters[0]).toMatchObject({ action: 'backdash', actionFrame: 1 });
    const x0 = at(r, 2).fighters[0].x;
    expect(x0 - at(r, 22).fighters[0].x).toBe(BACKDASH.moving * BACKDASH.speed);
  });

  describe('the back dash is invincible on its first 6 frames', () => {
    // Player 2 attacks on frame 3, so its attack is active on frames 8–11.
    const p2Attack = on(Physical, 3);

    it('control: without the back dash, the attack hits on frame 8', () => {
      const r = run(20, 0, p2Attack, fightAt(40));
      expect(r.events.find(e => e.type === 'hit')?.frame).toBe(8);
    });

    it('backdash frame 6 (game frame 8) is not hit; frame 7 (game frame 9) is', () => {
      const r = run(20, on(Left, 1, 3), p2Attack, fightAt(40));
      expect(at(r, 8).fighters[0]).toMatchObject({ action: 'backdash', actionFrame: 6 });
      expect(r.events.find(e => e.type === 'hit')?.frame).toBe(9);
    });
  });
});

describe('determinism', () => {
  it('the same inputs always give the same fight', () => {
    // A long, busy input script for both players.
    const p1 = (f: number) => [Right, Right | Physical, Up | Right, Left, 0, Physical][Math.floor(f / 7) % 6];
    const p2 = (f: number) => [Left, Physical, 0, Up, Left | Physical][Math.floor(f / 11) % 5];
    expect(run(900, p1, p2).final).toEqual(run(900, p1, p2).final);
  });

  it('step() never changes the state it was given', () => {
    const state = createFight();
    const copy = structuredClone(state);
    run(30, between(Right, 1, 30), 0, state);
    expect(state).toEqual(copy);
  });

  it('positions are always whole sub-pixels', () => {
    const r = run(600, f => [Right, Up | Right, Physical, Left][Math.floor(f / 13) % 4], on(Physical, 50, 120, 200));
    for (const s of r.frames) {
      for (const f of s.fighters) expect(Number.isInteger(f.x) && Number.isInteger(f.y)).toBe(true);
    }
  });
});
