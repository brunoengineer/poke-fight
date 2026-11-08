// Specials and the PP bar (plan.md §4.4): the elemental special is always a range attack (K, ¼ PP), the big special
// needs and spends the full bar (I). Landing hits refills PP; being hit or blocking doesn't.

import { describe, expect, it } from 'vitest';
import { ELEMENTAL_COST, MAX_HP, PP_MAX, PP_START, STAGE_WIDTH, px } from './constants';
import { BIG, ELEMENTAL, PHYSICAL, moveLength, type BigShape, type ElementalShape } from './frame-data';
import { Button } from './input';
import { createFight, type FightOptions, type Loadout } from './state';
import { at, fightAt, on, run, specialDamage, TACKLE_DAMAGE } from './testing';

const { Physical, Special, Big, Up } = Button;

/** Normal-type test specials (the test fighters are Normal: same-type bonus). A big rush is physical. */
function loadout(elemental: ElementalShape, big: BigShape): Loadout {
  return {
    elemental: { name: 'Test', type: 'normal', power: 40, category: 'special', shape: elemental },
    big: { name: 'Test Big', type: 'normal', power: 110, category: big === 'rush' ? 'physical' : 'special', shape: big },
  };
}

/** Both fighters with these specials, at this distance. */
function setup(distance: number, elemental: ElementalShape, big: BigShape, extra: Omit<FightOptions, 'x' | 'fighters'> = {}) {
  const state = fightAt(distance, extra);
  for (const f of state.fighters) f.loadout = loadout(elemental, big);
  return state;
}

describe('PP bar', () => {
  it(`starts at ${PP_START} of ${PP_MAX}`, () => {
    expect(createFight().fighters.map(f => f.pp)).toEqual([PP_START, PP_START]);
  });

  it(`a landed tackle gives ${PHYSICAL.hit.ppGain} PP; being hit gives nothing`, () => {
    const r = run(30, on(Physical, 1), 0, fightAt(40));
    expect(r.final.fighters.map(f => f.pp)).toEqual([PP_START + PHYSICAL.hit.ppGain, PP_START]);
  });

  it('never goes above the maximum', () => {
    const r = run(30, on(Physical, 1), 0, fightAt(40, { pp: [95, 50] }));
    expect(r.final.fighters[0].pp).toBe(PP_MAX);
  });
});

describe('elemental special (K)', () => {
  it(`costs ${ELEMENTAL_COST} PP, paid when the charge starts`, () => {
    const r = run(1, Special);
    expect(at(r, 1).fighters[0]).toMatchObject({ action: 'elemental', actionFrame: 1, pp: PP_START - ELEMENTAL_COST });
    expect(r.events).toEqual([{ type: 'special', fighter: 0, slot: 'elemental', frame: 1 }]);
  });

  it('does nothing without enough PP', () => {
    const r = run(10, on(Special, 1), 0, fightAt(200, { pp: [ELEMENTAL_COST - 1, 50] }));
    expect(at(r, 1).fighters[0].action).toBe('idle');
    expect(r.final.fighters[0].pp).toBe(ELEMENTAL_COST - 1);
  });

  it('projectile: 14 frames of charge, fired on frame 15, free again on frame 34', () => {
    expect(moveLength(ELEMENTAL.projectile)).toBe(33);
    const r = run(40, on(Special, 1), 0, setup(300, 'projectile', 'beam'));
    expect(at(r, 14).projectiles).toHaveLength(0);
    expect(at(r, 15).projectiles).toHaveLength(1);
    expect(at(r, 33).fighters[0].action).toBe('elemental');
    expect(at(r, 34).fighters[0]).toMatchObject({ action: 'idle', actionable: true });
  });

  it('the projectile flies 4 px per frame and hits from 100 px away on frame 28', () => {
    const r = run(60, on(Special, 1), 0, setup(100, 'projectile', 'beam'));
    const p15 = at(r, 15).projectiles[0];
    expect(at(r, 16).projectiles[0].x - p15.x).toBe(px(4));
    const hit = r.events.find(e => e.type === 'hit');
    expect(hit).toMatchObject({ attacker: 0, damage: specialDamage('elemental', setup(100, 'projectile', 'beam')), frame: 28 });
    // Used up on contact.
    expect(at(r, 28).projectiles).toHaveLength(0);
    expect(r.final.fighters[0].pp).toBe(PP_START - ELEMENTAL_COST + ELEMENTAL.projectile.hit.ppGain);
  });

  it('a projectile that reaches the edge of the screen disappears', () => {
    const state = createFight();
    state.projectiles.push({
      id: 1,
      owner: 0,
      slot: 'elemental',
      attack: { power: 40, type: 'normal', category: 'special' },
      x: STAGE_WIDTH + px(4),
      halfWidth: px(8),
      y1: px(18),
      y2: px(34),
      vx: px(4),
      hit: ELEMENTAL.projectile.hit,
    });
    expect(run(1, 0, 0, state).final.projectiles).toHaveLength(0);
  });

  it('beam: hits instantly on frame 15, up to ~230 px away', () => {
    expect(run(30, on(Special, 1), 0, setup(200, 'beam', 'beam')).events.find(e => e.type === 'hit')?.frame).toBe(15);
    expect(run(40, on(Special, 1), 0, setup(250, 'beam', 'beam')).events.filter(e => e.type === 'hit')).toEqual([]);
  });

  it('a hit during the charge cancels it, and the PP is lost', () => {
    const r = run(60, on(Special, 1), on(Physical, 1), setup(40, 'projectile', 'beam'));
    expect(r.frames.every(s => s.projectiles.length === 0)).toBe(true);
    expect(r.events.filter(e => e.type === 'hit').map(e => (e.type === 'hit' ? e.attacker : -1))).toEqual([1]);
    expect(r.final.fighters[0].pp).toBe(PP_START - ELEMENTAL_COST);
  });

  it('works in the air (one air move per jump), fired at the jump height', () => {
    // Jump on frame 1 (in the air from frame 4), special on frame 8: fired on frame 22, still in the air.
    const r = run(30, f => (f === 1 ? Up : f === 8 ? Special : 0), 0, setup(300, 'projectile', 'beam'));
    expect(at(r, 8).fighters[0]).toMatchObject({ action: 'elemental', actionFrame: 1 });
    const shot = at(r, 22).projectiles[0];
    expect(shot.y1).toBeGreaterThan(px(18));
  });

  it('in the air, landing before the end of the charge loses the special', () => {
    // Special on frame 30: the charge would end on frame 44, but the jump lands on frame 40.
    const r = run(60, f => (f === 1 ? Up : f === 30 ? Special : 0), 0, setup(300, 'projectile', 'beam'));
    expect(at(r, 40).fighters[0].action).toBe('land');
    expect(r.frames.every(s => s.projectiles.length === 0)).toBe(true);
  });

  it('only one air move per jump: an air attack then a special does nothing more', () => {
    const r = run(30, f => (f === 1 ? Up : f === 6 ? Physical : f === 20 ? Special : 0), 0, setup(300, 'projectile', 'beam'));
    expect(r.frames.some(s => s.fighters[0].action === 'elemental')).toBe(false);
    expect(r.final.fighters[0].pp).toBe(PP_START);
  });

  it('two elemental projectiles that meet cancel each other out', () => {
    const r = run(80, on(Special, 1), on(Special, 1), setup(200, 'projectile', 'beam'));
    expect(r.events.filter(e => e.type === 'hit')).toEqual([]);
    expect(r.final.projectiles).toHaveLength(0);
    expect(r.final.fighters.map(f => f.hp)).toEqual([MAX_HP, MAX_HP]);
  });
});

describe('big special (I)', () => {
  it('needs a full PP bar and spends all of it', () => {
    expect(at(run(1, Big, 0, fightAt(200, { pp: [PP_MAX - 1, 50] })), 1).fighters[0].action).toBe('idle');
    const r = run(1, Big, 0, fightAt(200, { pp: [PP_MAX, 50] }));
    expect(at(r, 1).fighters[0]).toMatchObject({ action: 'big', pp: 0 });
  });

  it('cannot be used in the air', () => {
    const r = run(20, f => (f === 1 ? Up : f === 8 ? Big : 0), 0, fightAt(200, { pp: [PP_MAX, 50] }));
    expect(r.frames.some(s => s.fighters[0].action === 'big')).toBe(false);
    expect(r.final.fighters[0].pp).toBe(PP_MAX);
  });

  it('has a 40-frame charge: a beam reaches across the whole screen on frame 41', () => {
    const state = createFight({ x: [px(40), px(440)], pp: [PP_MAX, 50] });
    for (const f of state.fighters) f.loadout = loadout('projectile', 'beam');
    const r = run(60, on(Big, 1), 0, state);
    const hit = r.events.find(e => e.type === 'hit');
    expect(hit).toMatchObject({ frame: 41, damage: specialDamage('big', state), big: true });
  });

  it('knocks the opponent down, with a long hitstop', () => {
    const r = run(80, on(Big, 1), 0, setup(200, 'projectile', 'beam', { pp: [PP_MAX, 50] }));
    const hit = r.events.find(e => e.type === 'hit')!;
    expect(at(r, hit.frame).hitstop).toBe(BIG.beam.hit.hitstop);
    expect(at(r, hit.frame + BIG.beam.hit.hitstop + 1).fighters[1].action).toBe('airHitstun');
  });

  it('rush: charges through the opponent, hits it, and ends up on the other side', () => {
    const r = run(120, on(Big, 1), 0, setup(100, 'projectile', 'rush', { pp: [PP_MAX, 50] }));
    const state = setup(100, 'projectile', 'rush', { pp: [PP_MAX, 50] });
    expect(r.events.find(e => e.type === 'hit')).toMatchObject({ attacker: 0, damage: specialDamage('big', state), big: true });
    expect(r.final.fighters[0].x).toBeGreaterThan(r.final.fighters[1].x);
  });

  it('a guarded rush stops at the defender, stuck in its long recovery (it can be punished)', () => {
    const r = run(70, on(Big, 1), Button.Guard, setup(100, 'projectile', 'rush', { pp: [PP_MAX, 50] }));
    expect(r.events.filter(e => e.type === 'block' || e.type === 'hit').map(e => e.type)).toEqual(['block']);
    const [rusher, defender] = r.final.fighters;
    expect(rusher.x).toBeLessThan(defender.x);
    expect(rusher).toMatchObject({ action: 'big' });
    // Within reach of a punishing tackle: its hit box (46 px) + lunge (13.5 px) + the body's half width (16 px).
    expect((defender.x - rusher.x) / 256).toBeLessThan(46 + 13.5 + 16);
  });

  it('a big projectile goes through a small one and still hits', () => {
    // Player 2's big projectile (fired on frame 41) meets player 1's small one (fired on frame 41 too).
    const r = run(150, on(Special, 27), on(Big, 1), setup(300, 'projectile', 'projectile', { pp: [50, PP_MAX] }));
    const hits = r.events.filter(e => e.type === 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ attacker: 1, big: true });
  });
});

describe('combo scaling', () => {
  it('each hit in a combo does 10% less, down to 40%', async () => {
    const { scaledDamage } = await import('./damage');
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(hits => scaledDamage(100, hits))).toEqual([100, 90, 80, 70, 60, 50, 40, 40, 40]);
  });

  it('a jump-in followed by a tackle is a combo: the tackle does 90%', () => {
    // Jump forward, air attack late in the jump, then a tackle buffered on landing.
    const r = run(80, f => (f <= 3 ? Up | Button.Right : 0) | (f === 30 || f === 46 ? Physical : 0), 0, fightAt(90));
    const hits = r.events.filter(e => e.type === 'hit');
    expect(hits).toHaveLength(2);
    expect(hits[1]).toMatchObject({ combo: 2, damage: Math.floor(TACKLE_DAMAGE * 0.9) });
  });
});
