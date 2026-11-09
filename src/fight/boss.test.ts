// Legendary bosses (fight/boss.ts): the schedule, each attack's telegraph and active frames, how each one is survived,
// and that a fighter without `boss` is untouched.

import { describe, expect, it } from 'vitest';
import {
  BOSS_ATTACK,
  BOSS_ATTACKS,
  BOSS_HP_MULTIPLIER,
  BOSS_SCHEDULE,
  bossStage,
  makeBoss,
  METEOR,
  NOVA,
  QUAKE,
  RAMPAGE,
  SLASH,
  VORTEX,
  type BossAttackId,
} from './boss';
import { createBattle } from './battle';
import { MAX_HP, px, SUB } from './constants';
import { Button, type InputMask } from './input';
import { createFight, type FightEvent, type FightOptions, type FightState } from './state';
import { step } from './step';
import { bossDamage, run, TACKLE_DAMAGE } from './testing';

/** Player 1 against a boss (player 2) whose first attack starts on frame 1. */
function bossFight(attacks: BossAttackId[], options: { x?: FightOptions['x']; bossHp?: number; tough?: boolean } = {}): FightState {
  // A tough player 1 never faints, for the tests that watch a whole attack (its damage isn't the point there).
  const p1 = options.tough ? { maxHp: MAX_HP * 100 } : {};
  const state = createFight({ x: options.x, fighters: [p1, { boss: { attacks, seed: 7 } }] });
  state.fighters[1].boss!.wait = 0;
  if (options.bossHp !== undefined) state.fighters[1].hp = options.bossHp;
  return state;
}

/** The attack's own frame for a fight frame: hitstop frames (when everything is frozen) don't count. */
function attackFrame(frames: readonly FightState[], fightFrame: number): number {
  let frozen = 0;
  for (let f = 2; f <= fightFrame; f++) if (frames[f - 2].hitstop > 0) frozen++;
  return fightFrame - frozen;
}

/** Runs a fight where player 1 reacts to the state (a scripted dodge); the boss presses nothing. */
function drive(frames: number, policy: (s: FightState) => InputMask, start: FightState) {
  let state = start;
  const events: (FightEvent & { frame: number })[] = [];
  for (let i = 0; i < frames; i++) {
    const result = step(state, [policy(state), 0]);
    state = result.state;
    events.push(...result.events.map(e => ({ ...e, frame: state.frame })));
  }
  return { events, final: state };
}

const bossHits = (events: readonly FightEvent[]) => events.filter(e => (e.type === 'hit' || e.type === 'block') && e.source === 'boss');
/** "attack phase frame" for each bossAttack event, in the attack's own frames (see attackFrame). */
const phases = (r: { frames: readonly FightState[]; events: readonly (FightEvent & { frame: number })[] }) =>
  r.events.flatMap(e => (e.type === 'bossAttack' ? [`${e.attack} ${e.phase} ${attackFrame(r.frames, e.frame)}`] : []));
const damageTaken = (s: FightState) => MAX_HP - s.fighters[0].hp;

describe('legendary bosses: the contract', () => {
  it('lists its attacks and makes a boss with 4× the HP', () => {
    expect(BOSS_ATTACKS).toEqual(['slash', 'nova', 'meteor', 'quake', 'rampage', 'vortex']);
    expect(BOSS_HP_MULTIPLIER).toBe(4);
    const member = { name: 'Mewtwo', maxHp: 1000, hp: 900 };
    expect(makeBoss(member, ['slash', 'nova'])).toEqual({ name: 'Mewtwo', maxHp: 4000, hp: 3600, boss: { attacks: ['slash', 'nova'] } });
  });

  it('a fighter without boss is exactly as before (no boss key, no boss events)', () => {
    const plain = createFight();
    expect(plain.fighters.every(f => !('boss' in f))).toBe(true);
    const r = run(1200, 0, Button.Physical);
    expect(r.events.some(e => e.type.startsWith('boss'))).toBe(false);
  });

  it('a battle team member keeps its boss setup into the round', () => {
    const boss = makeBoss({ ...createFight().fighters[1], speciesId: 150, name: 'Mewtwo', maxHp: MAX_HP, hp: MAX_HP, pp: 0 }, ['nova']);
    const battle = createBattle([[{ ...createFight().fighters[0], maxHp: MAX_HP, hp: MAX_HP }], [boss]]);
    expect(battle.round.fighters[1].boss).toMatchObject({ attacks: ['nova'], turn: 0, current: null });
    expect(battle.round.fighters[1].maxHp).toBe(MAX_HP * 4);
  });
});

describe('telegraph, active and recovery frames', () => {
  // [attack, frame the boss is free again, frame the attack is over] with the attack starting on frame 1.
  const TIMELINE: [BossAttackId, number, number][] = [
    ['slash', 48 + 12 + 28, 88],
    ['nova', 54 + 24 + 18 + 24, 120],
    ['meteor', 36 + 12, 36 + 300 + 14],
    ['quake', 42 + 48 + 24, 42 + 1 + 48 + 80],
    ['vortex', 36 + 120 + 3 + 30, 189],
  ];

  it.each(TIMELINE)('%s: telegraph from frame 1, active after it; the boss is locked until frame %i', (attack, free, over) => {
    // Far apart and guarding, so nothing knocks player 1 around (the timings don't depend on hits).
    const r = run(over + 60, Button.Guard, 0, bossFight([attack], { x: [px(30), px(450)], tough: true }));
    const t = BOSS_ATTACK[attack].telegraph;
    expect(t).toBeGreaterThanOrEqual(36); // 0.6 s at least: time to read it
    expect(t).toBeLessThanOrEqual(60);
    expect(phases(r)).toEqual([`${attack} telegraph 1`, `${attack} active ${t + 1}`, `${attack} end ${over}`]);
    // The boss on its attack's frame n (the first fight frame that reaches it).
    const boss = (n: number) => r.frames[r.frames.findIndex((_, i) => attackFrame(r.frames, i + 1) === n)].fighters[1];
    expect(bossStage(boss(t).boss!.current!)).toBe('telegraph');
    expect(bossStage(boss(t + 1).boss!.current!)).toBe('active');
    expect(boss(free - 1).action).toBe('bossAttack');
    expect(boss(free).action).toBe('idle');
  });

  it('rampage: telegraph 48 frames, two passes, then 30 frames of recovery', () => {
    const r = run(400, Button.Guard, 0, bossFight(['rampage'], { tough: true }));
    const p = phases(r);
    expect(p.slice(0, 2)).toEqual(['rampage telegraph 1', 'rampage active 49']);
    // Runs left from 320 to the wall (16 px) at 8 px a frame, turns for 14 frames, runs right to the far wall (464).
    const firstRun = Math.ceil((320 - 16) / 8);
    const secondRun = Math.ceil((464 - 16) / 8);
    const end = 48 + firstRun + RAMPAGE.turn + secondRun + RAMPAGE.recovery;
    expect(p[2]).toBe(`rampage end ${end}`);
  });
});

describe('Great Slash', () => {
  it('hits from across the screen even in the air; it is physical, power 90', () => {
    expect(BOSS_ATTACK.slash).toMatchObject({ power: 90, category: 'physical', guard: 4 });
    const start = bossFight(['slash']);
    // Jumping over and over: in the air when the wave passes.
    const r = run(80, Button.Up, 0, start);
    const [hit] = bossHits(r.events);
    expect(hit).toMatchObject({ type: 'hit', bossAttack: 'slash', air: true, damage: bossDamage(start, 'slash') });
    // The wave starts on frame 49 at the boss (320 px) and moves 14 px a frame: it reaches 160 px on frame 60.
    expect(r.events.find(e => e.type === 'hit')!.frame).toBe(48 + Math.ceil((320 - 160) / (SLASH.speed / SUB)));
  });

  it('even a back dash timed on the wave does not get through', () => {
    const start = bossFight(['slash']);
    const backdash = (f: number) => (f === 57 ? Button.Dash | Button.Left : Button.Left);
    expect(bossHits(run(80, backdash, 0, start).events)).toHaveLength(1);
  });

  it('crosses over: it goes towards the opponent when it is released', () => {
    // Player 1 jumps over the boss during the telegraph; the wave still goes its way.
    const start = bossFight(['slash'], { x: [px(280), px(320)] });
    const r = run(100, (f: number) => (f <= 20 ? Button.Up | Button.Right : 0), 0, start);
    expect(r.frames[50].fighters[0].x).toBeGreaterThan(r.frames[50].fighters[1].x);
    expect(bossHits(r.events)).toHaveLength(1);
  });

  it('a guard keeps 25% of it', () => {
    const start = bossFight(['slash']);
    const r = run(80, Button.Guard, 0, start);
    const [block] = bossHits(r.events);
    expect(block).toMatchObject({ type: 'block', bossAttack: 'slash', chip: Math.floor(bossDamage(start, 'slash') / 4) });
    expect(damageTaken(r.final)).toBe(Math.floor(bossDamage(start, 'slash') / 4));
  });
});

describe('Nova', () => {
  it('special, power 100; grows to a 200 px radius', () => {
    expect(BOSS_ATTACK.nova).toMatchObject({ power: 100, category: 'special', guard: 4 });
    expect(NOVA.radius).toBe(px(200));
  });

  it('far enough away, nothing happens', () => {
    // 410 px apart: the edge of player 1's body is 394 px from the boss's center.
    const r = run(130, 0, 0, bossFight(['nova'], { x: [px(30), px(440)] }));
    expect(bossHits(r.events)).toEqual([]);
    expect(damageTaken(r.final)).toBe(0);
  });

  it('inside, it hits once; walking out during the telegraph avoids it', () => {
    const start = bossFight(['nova'], { x: [px(200), px(380)] });
    const stand = run(130, 0, 0, start);
    expect(bossHits(stand.events)).toEqual([expect.objectContaining({ type: 'hit', damage: bossDamage(start, 'nova') })]);
    // Walking back from 200 px reaches the wall's side before the sphere's edge gets there.
    const away = run(130, (f: number) => (f % 22 === 1 ? Button.Dash | Button.Left : Button.Left), 0, start);
    expect(bossHits(away.events)).toEqual([]);
  });

  it('a guard inside keeps 25% of it', () => {
    const start = bossFight(['nova']);
    const r = run(130, Button.Guard, 0, start);
    expect(bossHits(r.events)).toEqual([expect.objectContaining({ type: 'block', chip: Math.floor(bossDamage(start, 'nova') / 4) })]);
  });
});

describe('Sky Fall', () => {
  it('special, power 50; meteors fall for 5 s, each warned 0.6 s ahead', () => {
    expect(BOSS_ATTACK.meteor).toMatchObject({ power: 50, category: 'special', guard: 2 });
    const r = run(450, Button.Guard, 0, bossFight(['meteor'], { x: [px(30), px(450)], tough: true }));
    const impacts = r.events.filter(e => e.type === 'bossImpact').map(e => ({ ...e, frame: attackFrame(r.frames, e.frame) }));
    const t = BOSS_ATTACK.meteor.telegraph;
    expect(METEOR.warning).toBe(36);
    // The first appears when the cast ends and lands 36 frames later; none lands after the 5 seconds.
    expect(impacts[0].frame).toBe(t + 1 + METEOR.warning);
    expect(impacts.at(-1)!.frame).toBeLessThanOrEqual(t + 300);
    expect(impacts).toHaveLength(15);
    // Each one shows its warning on the ground before it lands.
    const warned = r.frames[t + 1].fighters[1].boss!.current!.parts[0];
    expect(warned).toMatchObject({ kind: 'meteor', born: t + 1, land: t + 1 + METEOR.warning });
  });

  it('standing still gets hit', () => {
    const start = bossFight(['meteor']);
    const r = run(400, 0, 0, start);
    const hits = bossHits(r.events);
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits[0]).toMatchObject({ type: 'hit', bossAttack: 'meteor', damage: bossDamage(start, 'meteor') });
  });

  it('a scripted dodge (walking out of every warning) takes no damage', () => {
    const start = bossFight(['meteor'], { x: [px(160), px(400)] });
    const dodge = (s: FightState): InputMask => {
      const me = s.fighters[0];
      const meteors = s.fighters[1].boss?.current?.parts ?? [];
      const danger = (x: number) => meteors.some(m => m.land >= s.fighters[1].boss!.current!.frame && Math.abs(m.x - x) < px(36));
      if (!danger(me.x)) return 0;
      // Walk to the nearest safe place.
      for (let d = px(4); d < px(240); d += px(4)) {
        if (me.x - d > px(20) && !danger(me.x - d)) return Button.Left;
        if (me.x + d < px(360) && !danger(me.x + d)) return Button.Right;
      }
      return 0;
    };
    const r = drive(400, dodge, start);
    expect(r.events.filter(e => e.type === 'bossImpact').length).toBe(15);
    expect(bossHits(r.events)).toEqual([]);
    expect(damageTaken(r.final)).toBe(0);
  });

  it('a guard keeps 50% of each meteor', () => {
    const start = bossFight(['meteor']);
    const r = run(400, Button.Guard, 0, start);
    const blocks = bossHits(r.events);
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks.every(e => e.type === 'block' && e.chip === Math.floor(bossDamage(start, 'meteor') / 2))).toBe(true);
  });

  it('the boss fights during the rain (and can be stunned then)', () => {
    const start = bossFight(['meteor'], { x: [px(30), px(450)] });
    // Player 2 tackles on frame 60, well inside the rain.
    const r = run(70, Button.Guard, (f: number) => (f === 60 ? Button.Physical : 0), start);
    expect(r.frames[60].fighters[1].action).toBe('attack');
    expect(r.frames[60].fighters[1].boss!.current!.id).toBe('meteor');
  });

  it('enraged, more meteors fall', () => {
    const r = run(450, Button.Guard, 0, bossFight(['meteor'], { x: [px(30), px(450)], bossHp: MAX_HP / 5, tough: true }));
    expect(r.events.filter(e => e.type === 'bossImpact')).toHaveLength(22);
  });
});

describe('Shockwave (extra)', () => {
  it('physical, power 65: two slams, each sends a wave both ways along the floor', () => {
    expect(BOSS_ATTACK.quake).toMatchObject({ power: 65, category: 'physical', guard: 2 });
    const r = run(60, Button.Guard, 0, bossFight(['quake'], { x: [px(30), px(450)] }));
    expect(r.frames[42].fighters[1].boss!.current!.parts.map(p => p.dir)).toEqual([-1, 1]);
    expect(QUAKE.gap).toBe(48);
  });

  it('standing still gets hit by both waves', () => {
    const start = bossFight(['quake']);
    const hits = bossHits(run(140, 0, 0, start).events);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ type: 'hit', damage: bossDamage(start, 'quake') });
  });

  it('jumping each wave avoids them', () => {
    const start = bossFight(['quake']);
    const jumpWaves = (s: FightState): InputMask => {
      const me = s.fighters[0];
      const waves = s.fighters[1].boss?.current?.parts ?? [];
      const coming = waves.some(w => !w.hit && Math.sign(me.x - w.x) === w.dir && Math.abs(me.x - w.x) < px(70));
      return coming ? Button.Up : 0;
    };
    const r = drive(140, jumpWaves, start);
    expect(bossHits(r.events)).toEqual([]);
  });

  it('a guard keeps 50%', () => {
    const start = bossFight(['quake']);
    const blocks = bossHits(run(140, Button.Guard, 0, start).events);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toMatchObject({ type: 'block', chip: Math.floor(bossDamage(start, 'quake') / 2) });
  });
});

describe('Rampage (extra)', () => {
  it('physical, power 80: the boss charges through, there and back', () => {
    expect(BOSS_ATTACK.rampage).toMatchObject({ power: 80, category: 'physical', guard: 4 });
    const start = bossFight(['rampage']);
    const r = run(200, 0, 0, start);
    const hits = bossHits(r.events);
    expect(hits[0]).toMatchObject({ type: 'hit', bossAttack: 'rampage', damage: bossDamage(start, 'rampage') });
    // It ran to the left wall and came back to the right one.
    expect(Math.min(...r.frames.map(s => s.fighters[1].x))).toBe(px(16));
    expect(r.final.fighters[1].x).toBe(px(464));
  });

  it('jumping over it avoids both passes', () => {
    const start = bossFight(['rampage']);
    const jumpIt = (s: FightState): InputMask => {
      const [me, boss] = s.fighters;
      const a = boss.boss?.current;
      // Jump when it charges towards player 1 (or is about to) and gets close.
      const coming = a?.run === 'run' ? Math.sign(me.x - boss.x) === a.dir : a?.run === 'wind' && a.frame > 40;
      return coming && Math.abs(me.x - boss.x) < px(112) ? Button.Up : 0;
    };
    const r = drive(300, jumpIt, start);
    expect(r.events.filter(e => e.type === 'bossAttack' && e.phase === 'end')).toHaveLength(1);
    expect(bossHits(r.events)).toEqual([]);
  });

  it('a guard keeps 25% of each pass', () => {
    const start = bossFight(['rampage']);
    const blocks = bossHits(run(300, Button.Guard, 0, start).events);
    expect(blocks).toHaveLength(2);
    expect(blocks.every(e => e.type === 'block' && e.chip === Math.floor(bossDamage(start, 'rampage') / 4))).toBe(true);
  });
});

describe('Vortex (extra)', () => {
  it('special, power 90: pulls for 2 s, then bursts 72 px around the boss', () => {
    expect(BOSS_ATTACK.vortex).toMatchObject({ power: 90, category: 'special', guard: 4 });
    expect(VORTEX).toMatchObject({ pullFrames: 120, radius: px(72) });
    const start = bossFight(['vortex']);
    const r = run(200, 0, 0, start);
    // Pulled 1.25 px a frame from 160 px away, up to 40 px from the boss.
    expect(r.frames[36 + 60 - 1].fighters[0].x).toBe(px(160) + 60 * VORTEX.pull);
    expect(bossHits(r.events)).toEqual([expect.objectContaining({ type: 'hit', damage: bossDamage(start, 'vortex') })]);
    expect(r.events.find(e => e.type === 'hit')!.frame).toBe(36 + 120 + 1);
  });

  it('walking away resists the pull and avoids the burst', () => {
    const r = run(200, Button.Left, 0, bossFight(['vortex']));
    expect(bossHits(r.events)).toEqual([]);
    expect(r.frames[36 + 120].fighters[0].x).toBeLessThan(px(160));
  });

  it('a guard keeps 25%', () => {
    const start = bossFight(['vortex']);
    expect(bossHits(run(200, Button.Guard, 0, start).events)).toEqual([
      expect.objectContaining({ type: 'block', chip: Math.floor(bossDamage(start, 'vortex') / 4) }),
    ]);
  });
});

describe('super armor', () => {
  it('during its attack the boss takes damage but keeps going', () => {
    const start = bossFight(['nova'], { x: [px(200), px(240)] });
    const r = run(45, (f: number) => (f === 2 || f === 28 ? Button.Physical : 0), 0, start);
    const hits = r.events.filter(e => e.type === 'hit' && e.attacker === 0);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ damage: TACKLE_DAMAGE });
    const dealt = hits.reduce((sum, e) => sum + (e.type === 'hit' ? e.damage : 0), 0);
    expect(r.final.fighters[1]).toMatchObject({ action: 'bossAttack', hp: MAX_HP - dealt });
    // Never stunned: its attack went on every frame (hitstop aside).
    expect(r.frames.every(s => s.fighters[1].action === 'bossAttack')).toBe(true);
  });

  it('a K.O. ends the attack on the spot', () => {
    const start = bossFight(['meteor'], { x: [px(200), px(240)], bossHp: 1 });
    const r = run(60, (f: number) => (f === 2 ? Button.Physical : 0), 0, start);
    expect(r.final.winner).toBe(0);
    expect(r.final.fighters[1].boss!.current).toBeNull();
    expect(phases(r).at(-1)).toMatch(/^meteor end/);
  });

  it('a boss that wins in the middle of its attack stops there (not left locked)', () => {
    const start = bossFight(['vortex']);
    start.fighters[0].hp = 1;
    const r = run(200, 0, 0, start);
    expect(r.final.winner).toBe(1);
    expect(r.final.fighters[1]).toMatchObject({ action: 'idle', boss: { current: null } });
  });
});

describe('the schedule', () => {
  /** Telegraph frames of a nova-only boss far away from player 1 (it never connects), over a minute. */
  const starts = (hp: number, seed = 7) => {
    const state = createFight({ x: [px(20), px(460)], fighters: [{}, { boss: { attacks: ['nova'], seed } }] });
    state.fighters[1].hp = hp;
    const r = run(3600, 0, 0, state);
    return r.events.flatMap(e => (e.type === 'bossAttack' && e.phase === 'telegraph' ? [e.frame] : []));
  };
  const gaps = (frames: number[]) => frames.slice(1).map((f, i) => f - frames[i]);
  const NOVA_LENGTH = 120;

  it('the first attack comes after 4–6 s, then every 7–9 s (5–7 s of rest after each)', () => {
    const frames = starts(MAX_HP);
    expect(frames[0]).toBeGreaterThan(BOSS_SCHEDULE.first[0]);
    expect(frames[0]).toBeLessThanOrEqual(BOSS_SCHEDULE.first[1] + 1);
    for (const gap of gaps(frames)) {
      expect(gap).toBeGreaterThanOrEqual(NOVA_LENGTH + BOSS_SCHEDULE.wait[0]);
      expect(gap).toBeLessThanOrEqual(NOVA_LENGTH + BOSS_SCHEDULE.wait[1] + 1);
    }
  });

  it('is the same for the same seed, and different for another', () => {
    expect(starts(MAX_HP)).toEqual(starts(MAX_HP));
    expect(starts(MAX_HP, 8)).not.toEqual(starts(MAX_HP));
  });

  it('enraged below 30% HP: attacks come more often', () => {
    const calm = starts(MAX_HP);
    const enraged = starts(MAX_HP * 0.29);
    expect(enraged.length).toBeGreaterThan(calm.length);
    for (const gap of gaps(enraged)) expect(gap).toBeLessThanOrEqual(NOVA_LENGTH + BOSS_SCHEDULE.enraged[1] + 1);
    const r = run(2, 0, 0, bossFight(['nova'], { bossHp: MAX_HP * 0.29 }));
    expect(r.events.filter(e => e.type === 'bossEnraged')).toHaveLength(1);
  });

  it('goes round its list in order', () => {
    const state = createFight({ x: [px(20), px(460)], fighters: [{ maxHp: MAX_HP * 100 }, { boss: { attacks: ['nova', 'meteor', 'quake'], seed: 3 } }] });
    const r = run(5000, (f: number) => (f % 30 < 4 ? Button.Up : Button.Guard), 0, state);
    const order = r.events.flatMap(e => (e.type === 'bossAttack' && e.phase === 'telegraph' ? [e.attack] : []));
    expect(order.slice(0, 5)).toEqual(['nova', 'meteor', 'quake', 'nova', 'meteor']);
  });

  it('a boss attack is never nullified by type: typeless against an immune Pokémon', () => {
    const start = createFight({ fighters: [{ types: ['ghost'] }, { boss: { attacks: ['slash'] } }] });
    start.fighters[1].boss!.wait = 0;
    const [hit] = bossHits(run(80, 0, 0, start).events);
    expect(hit).toMatchObject({ type: 'hit', effectiveness: 1 });
    expect(hit.type === 'hit' && hit.damage).toBeGreaterThan(0);
  });
});
