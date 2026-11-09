// The big special's forms by type (plan.md §4.9): each one hits the way it looks, and each has a way to survive it.

import { describe, expect, it } from 'vitest';
import { strikeBox } from './boxes';
import { PP_MAX, px } from './constants';
import { BIG, type BigShape } from './frame-data';
import { Button } from './input';
import type { FightState } from './state';
import { at, between, damageOf, fightAt, on, run, specialDamage } from './testing';

const { Big, Up, Guard, Dash, Left, Right } = Button;

/** Both fighters with this big form (a Normal-type move of power 110, so damage is easy to compute), at a distance. */
function setup(distance: number, shape: BigShape): FightState {
  const state = fightAt(distance, { pp: [PP_MAX, 50] });
  for (const f of state.fighters) f.loadout.big = { name: 'Test Big', type: 'normal', power: 110, category: 'special', shape };
  return state;
}

const hitsOn = (r: ReturnType<typeof run>, defender: 0 | 1) => r.events.filter(e => e.type === 'hit' && e.defender === defender);

describe('every form', () => {
  it('has the same 40-frame charge and 30 frames of recovery (the charge is the risk, the form is how to survive)', () => {
    for (const move of Object.values(BIG)) {
      expect(move.startup).toBe(40);
      expect(move.recovery).toBe(30);
    }
  });
});

describe('quake (Ground)', () => {
  it('sends a ground wave each way on frame 41, low on the floor', () => {
    const r = run(41, on(Big, 1), 0, setup(200, 'quake'));
    const waves = at(r, 41).projectiles;
    expect(waves.map(p => Math.sign(p.vx))).toEqual([1, -1]);
    expect(waves.every(p => p.y1 === 0 && p.y2 === px(16))).toBe(true);
  });

  it('hits a standing opponent, and is jumped', () => {
    const r = run(120, on(Big, 1), 0, setup(200, 'quake'));
    expect(hitsOn(r, 1)).toHaveLength(1);
    // The wave reaches the opponent's feet around frame 74: jumping on frame 60 clears it.
    const jumped = run(120, on(Big, 1), on(Up, 60), setup(200, 'quake'));
    expect(hitsOn(jumped, 1)).toEqual([]);
  });
});

describe('surf (Water, Poison)', () => {
  it('is a wide wave, too tall to clear but at the very top of a jump; a guard blocks it', () => {
    const r = run(41, on(Big, 1), 0, setup(200, 'surf'));
    expect(at(r, 41).projectiles[0]).toMatchObject({ y1: 0, y2: px(72), halfWidth: px(22) });
    const guarded = run(140, on(Big, 1), between(Guard, 1, 140), setup(200, 'surf'));
    expect(guarded.events.filter(e => e.type === 'block')).toHaveLength(1);
    expect(hitsOn(guarded, 1)).toEqual([]);
  });

  it('hits a jump made too early', () => {
    const r = run(160, on(Big, 1), on(Up, 50), setup(200, 'surf'));
    expect(hitsOn(r, 1)).toHaveLength(1);
  });
});

describe('tornado (Fire, Flying)', () => {
  it('is taller than any jump: a jump over it is hit; a guard blocks it', () => {
    for (const jumpAt of [60, 80, 95]) {
      const r = run(200, on(Big, 1), on(Up, jumpAt), setup(200, 'tornado'));
      expect(hitsOn(r, 1), `jump on ${jumpAt}`).toHaveLength(1);
    }
    const guarded = run(200, on(Big, 1), between(Guard, 1, 200), setup(200, 'tornado'));
    expect(guarded.events.filter(e => e.type === 'block')).toHaveLength(1);
  });
});

describe('solar (Grass)', () => {
  it('hits across the whole screen on frame 41, from the floor up', () => {
    const r = run(60, on(Big, 1), 0, setup(400, 'solar'));
    expect(hitsOn(r, 1)[0]).toMatchObject({ frame: 41, big: true });
    expect(BIG.solar.hitbox).toMatchObject({ y1: 0, y2: px(64) });
  });
});

describe('blizzard (Ice)', () => {
  it('covers a big area in front: hits at 150 px, not at 250', () => {
    expect(hitsOn(run(70, on(Big, 1), 0, setup(150, 'blizzard')), 1)).toHaveLength(1);
    expect(hitsOn(run(70, on(Big, 1), 0, setup(250, 'blizzard')), 1)).toEqual([]);
  });
});

describe('burst (Psychic, Dark, Fairy)', () => {
  it('hits all around the attacker: at 80 px, not at 130', () => {
    expect(hitsOn(run(60, on(Big, 1), 0, setup(80, 'burst')), 1)).toHaveLength(1);
    expect(hitsOn(run(60, on(Big, 1), 0, setup(130, 'burst')), 1)).toEqual([]);
  });

  it('hits behind the attacker too (a jump over it does not escape)', () => {
    // The opponent jumps over the attacker during the charge and lands behind it.
    const state = setup(60, 'burst');
    const r = run(60, on(Big, 1), f => (f <= 3 ? Up | Left : 0), state);
    expect(at(r, 41).fighters[1].x).toBeLessThan(at(r, 41).fighters[0].x);
    expect(hitsOn(r, 1)).toHaveLength(1);
  });
});

describe('strike (Electric, Ghost)', () => {
  it("locks on the opponent's spot 12 frames before it hits, then strikes a column there on frame 41", () => {
    const state = setup(200, 'strike');
    const r = run(60, on(Big, 1), 0, state);
    expect(at(r, 27).fighters[0].target).toBeNull();
    expect(at(r, 28).fighters[0].target).toBe(state.fighters[1].x);
    expect(hitsOn(r, 1)[0]).toMatchObject({ frame: 41, big: true });
  });

  it('is dodged by moving once it locks (a dash), not by standing still or jumping in place', () => {
    const dashed = run(60, on(Big, 1), on(Dash, 29), setup(200, 'strike'));
    expect(hitsOn(dashed, 1)).toEqual([]);
    const jumped = run(60, on(Big, 1), on(Up, 30), setup(200, 'strike'));
    expect(hitsOn(jumped, 1)).toHaveLength(1);
  });

  it('its column is as tall as the stage', () => {
    expect(strikeBox(px(100), px(18))).toEqual({ x1: px(82), x2: px(118), y1: 0, y2: px(270) });
  });
});

describe('barrage (Rock, Dragon)', () => {
  it('throws three in arcs on frame 41; they land about 70, 130 and 190 px ahead and are gone', () => {
    const state = setup(400, 'barrage');
    const from = state.fighters[0].x;
    const r = run(80, on(Big, 1), 0, state);
    expect(at(r, 41).projectiles.every(p => p.vy !== undefined && p.vy > 0)).toBe(true);
    // Where each one is on the first frame its bottom touches the floor (within a frame's travel of its spot).
    const landed = at(r, 41).projectiles.map(rock => {
      for (let frame = 42; frame <= 80; frame++) {
        const now = at(r, frame).projectiles.find(p => p.id === rock.id);
        if (now && now.y1 <= 0) return Math.round((now.x - from) / px(1));
      }
      return null;
    });
    [70, 130, 190].forEach((d, k) => expect(Math.abs(landed[k]! - d)).toBeLessThanOrEqual(7));
    expect(at(r, 80).projectiles).toEqual([]);
  });

  it('each one hits with half the move power; standing beyond them is safe', () => {
    const state = setup(130, 'barrage');
    const r = run(100, on(Big, 1), 0, state);
    const half = damageOf(state, 0, { power: 55, type: 'normal', category: 'special' });
    expect(hitsOn(r, 1)[0]).toMatchObject({ damage: half, big: true });
    expect(half).toBeLessThan(specialDamage('big', state));
    expect(hitsOn(run(100, on(Big, 1), 0, setup(300, 'barrage')), 1)).toEqual([]);
  });
});

// Walking right after the lock isn't enough to leave a strike (a reminder of how far it reaches).
describe('strike reach', () => {
  it('walking away for its last 12 frames is not enough', () => {
    const r = run(60, on(Big, 1), between(Right, 29, 60), setup(200, 'strike'));
    expect(hitsOn(r, 1)).toHaveLength(1);
  });
});
