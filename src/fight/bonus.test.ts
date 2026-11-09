// Hits that hit harder (plan.md §4.3): a back attack after a dash through the opponent, and a counter after a parry.

import { describe, expect, it } from 'vitest';
import { MAX_HP } from './constants';
import { BACK_ATTACK, DASH, dashLength, PARRY } from './frame-data';
import { Button } from './input';
import { at, between, fightAt, on, run, TACKLE_DAMAGE } from './testing';

const { Physical, Special, Guard, Dash, Right } = Button;
const hits = (r: ReturnType<typeof run>, defender: 0 | 1) => r.events.filter(e => e.type === 'hit' && e.defender === defender);

describe('back attack: a dash through the opponent', () => {
  it('the first hit soon after a dash through does 1.5×, marked as a back attack', () => {
    // From 40 px the dash goes through (70 px); the tackle comes right after it ends.
    const r = run(60, f => (f === 1 ? Dash : f === dashLength(DASH) + 2 ? Physical : 0), 0, fightAt(40));
    expect(at(r, dashLength(DASH)).fighters[0].x).toBeGreaterThan(at(r, dashLength(DASH)).fighters[1].x);
    expect(hits(r, 1)[0]).toMatchObject({ damage: Math.round(TACKLE_DAMAGE * BACK_ATTACK.multiplier), bonus: 'back' });
  });

  it('only the first hit, and only within its window after the dash ends', () => {
    const late = dashLength(DASH) + BACK_ATTACK.window + 3;
    const r = run(late + 30, f => (f === 1 ? Dash : f === late ? Physical : 0), 0, fightAt(40));
    expect(hits(r, 1)[0]).toMatchObject({ damage: TACKLE_DAMAGE });
    expect(hits(r, 1)[0]).not.toHaveProperty('bonus');
  });

  it('a dash that stops short of the opponent gives nothing', () => {
    const r = run(60, f => (f === 1 ? Dash : f === dashLength(DASH) + 2 ? Physical | Right : 0), 0, fightAt(200));
    expect(r.frames.every(s => s.fighters[0].bonus === null)).toBe(true);
  });
});

describe('parry: guard pressed just before a hit', () => {
  // The tackle, pressed on frame 10, hits on frame 15.
  it('pressed 1–6 frames before the hit: no damage, the attacker staggers, then a counter does 1.5×', () => {
    for (const press of [10, 12, 15]) {
      const r = run(80, on(Physical, 10), f => (f >= press && f < press + 8 ? Guard : f === 15 + PARRY.hitstop + 3 ? Physical : 0), fightAt(40));
      expect(r.events.find(e => e.type === 'parry'), `guard on ${press}`).toMatchObject({ attacker: 0, defender: 1, source: 'tackle', frame: 15 });
      expect(hits(r, 0)[0], `guard on ${press}`).toMatchObject({ damage: Math.round(TACKLE_DAMAGE * PARRY.multiplier), bonus: 'counter' });
      expect(at(r, 15 + PARRY.hitstop + 1).fighters[0].action).toBe('hitstun');
      expect(at(r, 15 + PARRY.hitstop).fighters[1].hp).toBe(MAX_HP);
    }
  });

  it('pressed earlier (or held) is an ordinary guard', () => {
    const early = run(40, on(Physical, 10), between(Guard, 8, 40), fightAt(40));
    expect(early.events.map(e => e.type)).toEqual(['block']);
    const held = run(40, on(Physical, 10), Guard, fightAt(40));
    expect(held.events.map(e => e.type)).toEqual(['block']);
  });

  it('a projectile parried does nothing at all (no chip); its thrower, far away, is not stunned', () => {
    // A projectile from 200 px away reaches the defender around frame 49.
    const plain = run(80, on(Special, 1), between(Guard, 1, 80), fightAt(200));
    const hitFrame = plain.events.find(e => e.type === 'block')!.frame;
    const r = run(80, on(Special, 1), f => (f >= hitFrame - 2 ? Guard : 0), fightAt(200));
    expect(r.events.map(e => e.type)).toEqual(['special', 'parry']);
    expect(r.final.fighters[1].hp).toBe(MAX_HP);
    expect(r.frames.some(s => s.fighters[0].action === 'hitstun')).toBe(false);
  });
});
