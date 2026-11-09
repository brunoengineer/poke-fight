// Legendary bosses: a fighter whose setup has `boss` performs big attacks on its own, on a schedule, while its normal
// controller (the CPU) keeps fighting in between. Pure and seeded like the rest of the fight: the schedule's random
// numbers live in the boss's state (engine/rng.ts), so the same fight always plays the same way.
//
// Every attack has three parts the player can read:
//   1. a telegraph (0.6–0.9 s): the boss winds up and the screen shows where the danger will be;
//   2. the active part: the hazard itself (a wave, a sphere, falling meteors…);
//   3. a recovery: the boss stands open to a punish.
//
// Super armor (decided with the bosses): while the boss is locked in an attack (telegraph → recovery) it takes damage
// as usual but is never stunned or pushed. Without it, a player who keeps tackling would cancel every telegraph and
// the attacks would never come out; with it, the telegraph is a window to deal free damage *or* to get ready to
// survive, and the player has to pick. The armor ends with the recovery: during the meteor rain, which outlasts the
// cast, the boss fights normally and can be stunned.
//
// Each attack connects at most once per part (one wave, one meteor, one rampage pass…), through the fight's own hit
// rules (fight/step.ts): the real damage formula with the boss's stats, a guard that keeps a fraction of it, hitstop,
// knockdowns and K.O.s.

import { createRng } from '../engine/rng';
import { effectiveness } from '../data/types';
import { bodyBox, isInvincible, overlaps, type WorldBox } from './boxes';
import { BODY_HALF_WIDTH, BODY_HEIGHT, px, STAGE_WIDTH } from './constants';
import type { HitData } from './frame-data';
import type { AttackInfo, FightEvent, FightState, Fighter, FighterId } from './state';

export const BOSS_ATTACKS = ['slash', 'nova', 'meteor', 'quake', 'rampage', 'vortex'] as const;
export type BossAttackId = (typeof BOSS_ATTACKS)[number];

export const isBossAttack = (value: string): value is BossAttackId => (BOSS_ATTACKS as readonly string[]).includes(value);

/** A legendary boss has this many times its normal HP. */
export const BOSS_HP_MULTIPLIER = 4;

/** How a boss is declared (FighterSetup.boss). */
export interface BossSetup {
  /** Its attacks, used in this order, round and round. */
  attacks: BossAttackId[];
  /** Seed of its schedule (default: from its species and HP). */
  seed?: number;
}

/**
 * The schedule, in frames. The wait counts from the end of one attack to the start of the next, so with the attacks'
 * own length they come roughly every 6–9 s (3.5–5.5 s when enraged). The first one comes a little sooner.
 */
export const BOSS_SCHEDULE = {
  first: [240, 360] as const,
  wait: [300, 420] as const,
  enraged: [150, 240] as const,
  /** Below this % of its HP, the boss is enraged (and stays so). */
  enragedBelow: 30,
};

/** What a hit of each attack does (damage comes from the formula with this power and the boss's stats and type). */
export interface BossAttackData {
  telegraph: number;
  power: number;
  category: 'physical' | 'special';
  hit: HitData;
  /** A guard keeps 1/guard of the damage (4 = 25%). */
  guard: number;
}

const LAUNCH = { vy: px(5), push: px(3) };

export const BOSS_ATTACK: Record<BossAttackId, BossAttackData> = {
  slash: {
    telegraph: 48,
    power: 90,
    category: 'physical',
    guard: 4,
    hit: { hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: LAUNCH, big: true },
  },
  nova: {
    telegraph: 54,
    power: 100,
    category: 'special',
    guard: 4,
    hit: { hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: { vy: px(5), push: px(4) }, big: true },
  },
  meteor: {
    telegraph: 36,
    power: 50,
    category: 'special',
    guard: 2,
    hit: { hitstun: 20, blockstun: 14, knockback: px(2), hitstop: 6, ppGain: 0, chip: true, big: false },
  },
  quake: {
    telegraph: 42,
    power: 65,
    category: 'physical',
    guard: 2,
    hit: { hitstun: 24, blockstun: 16, knockback: px(2), hitstop: 8, ppGain: 0, chip: true, launch: { vy: px(4), push: px(1.5) }, big: false },
  },
  rampage: {
    telegraph: 48,
    power: 80,
    category: 'physical',
    guard: 4,
    hit: { hitstun: 30, blockstun: 20, knockback: px(4), hitstop: 12, ppGain: 0, chip: true, launch: { vy: px(5), push: px(4) }, big: true },
  },
  vortex: {
    telegraph: 36,
    power: 90,
    category: 'special',
    guard: 4,
    hit: { hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: { vy: px(6), push: px(4) }, big: true },
  },
};

/** Great Slash: a crescent wave across the whole screen, full height (jumping doesn't help). */
export const SLASH = { speed: px(14), swing: 12, recovery: 28 };

/** Nova: a sphere grows around the boss, lingers, fades. Only grow + linger hit. */
export const NOVA = { grow: 24, linger: 18, fade: 18, recovery: 24, startRadius: px(16), radius: px(200) };

/** Sky Fall: a short cast, then 5 s of meteors, each with a ground warning before it lands. */
export const METEOR = {
  cast: 12,
  rain: 300,
  warning: 36,
  every: 18,
  enragedEvery: 12,
  /** Every other meteor falls near the opponent (at most this far off), the rest anywhere. */
  aim: px(20),
  halfWidth: px(16),
  height: px(72),
  /** Frames an impact hits, then frames its blast stays on screen. */
  active: 3,
  linger: 14,
};

/** Shockwave: the boss slams the ground twice; each slam sends a wave along the floor both ways. Jump them (the gap
 * leaves time to land and jump again: one jump can't clear both). */
export const QUAKE = { speed: px(6), gap: 48, recovery: 24, halfWidth: px(10), height: px(18), range: 80 };

/** Rampage: the boss charges to the wall on the opponent's side, turns, and charges back. Jump over it or guard. */
export const RAMPAGE = { speed: px(8), turn: 14, recovery: 30, halfWidth: px(24), height: px(44) };

/** Vortex: pulls the opponent in for 2 s (walking away resists), then bursts around the boss. */
export const VORTEX = { pull: px(1.25), pullFrames: 120, keep: px(40), radius: px(72), active: 3, recovery: 30 };

/** A moving or falling part of an attack. Positions in sub-pixels; frames are the attack's own (BossAttack.frame). */
export interface BossPart {
  kind: 'wave' | 'shock' | 'meteor';
  x: number;
  dir: -1 | 0 | 1;
  /** The attack frame it appeared on. */
  born: number;
  /** Meteors: the attack frame it lands on. */
  land: number;
  hit: boolean;
}

export type BossStage = 'telegraph' | 'active' | 'recovery';

/** The attack in progress. */
export interface BossAttack {
  id: BossAttackId;
  /** 1 on the attack's first frame (the telegraph's first frame). */
  frame: number;
  /** The boss is locked in it (super armor). */
  locked: boolean;
  /** Where it goes: towards the opponent when the active part starts (slash, rampage). */
  dir: 1 | -1;
  /** Where the boss stood when it started (the nova's and the vortex's center). */
  x: number;
  /** The single hit of this attack (or of this rampage pass) already connected. */
  hit: boolean;
  parts: BossPart[];
  /** Meteors: how many fell so far. Rampage: the pass (0, 1). */
  count: number;
  /** Meteors: the frame the next one appears. Rampage: the frame its current stage started. */
  mark: number;
  /** Rampage only: running, turning at the wall, or recovering. */
  run: 'wind' | 'run' | 'turn' | 'recover';
}

/** A boss's schedule and attack, part of its Fighter (plain data, like the rest of the state). */
export interface BossState {
  attacks: BossAttackId[];
  /** How many attacks it started (the next one is attacks[turn % length]). */
  turn: number;
  /** Frames until the next attack may start. */
  wait: number;
  rng: number;
  enraged: boolean;
  current: BossAttack | null;
}

export type BossPhase = 'telegraph' | 'active' | 'end';

/** What an attack's part connected with this frame (step.ts turns it into a hit through the usual rules). */
export interface BossHit {
  boss: FighterId;
  attack: BossAttackId;
  /** The direction the defender is pushed. */
  away: number;
}

const between = (rng: ReturnType<typeof createRng>, [min, max]: readonly [number, number]) => min + rng.int(max - min + 1);

/** A legendary version of a team member: 4× its HP, with these attacks. */
export function makeBoss<T extends { maxHp: number; hp: number }>(member: T, attacks: readonly BossAttackId[] = BOSS_ATTACKS, seed?: number): T & { boss: BossSetup } {
  return {
    ...member,
    maxHp: member.maxHp * BOSS_HP_MULTIPLIER,
    hp: member.hp * BOSS_HP_MULTIPLIER,
    boss: { attacks: [...attacks], ...(seed === undefined ? {} : { seed }) },
  };
}

export function createBossState(setup: BossSetup, fallbackSeed: number): BossState {
  const rng = createRng(setup.seed ?? fallbackSeed);
  const wait = between(rng, BOSS_SCHEDULE.first);
  return { attacks: [...setup.attacks], turn: 0, wait, rng: rng.state, enraged: false, current: null };
}

export const isEnraged = (f: Fighter) => f.hp * 100 < f.maxHp * BOSS_SCHEDULE.enragedBelow;

const foeOf = (state: FightState, f: Fighter) => state.fighters[f.id === 0 ? 1 : 0];

/**
 * Before the fighters think: counts the wait down and starts the next attack when the boss is free on the ground.
 * (A boss in hitstun or in the middle of a tackle waits until it can act: the attack never interrupts a move.)
 */
export function scheduleBoss(state: FightState, boss: Fighter, events: FightEvent[]) {
  const b = boss.boss;
  if (!b || state.winner !== null) return;
  if (!b.enraged && isEnraged(boss)) {
    b.enraged = true;
    events.push({ type: 'bossEnraged', fighter: boss.id });
  }
  if (b.current || b.attacks.length === 0) return;
  if (b.wait > 0) {
    b.wait--;
    return;
  }
  if (!boss.actionable || boss.y !== 0 || boss.vy !== 0 || foeOf(state, boss).action === 'ko') return;
  const id = b.attacks[b.turn % b.attacks.length];
  b.turn++;
  b.current = { id, frame: 0, locked: true, dir: boss.facing, x: boss.x, hit: false, parts: [], count: 0, mark: 0, run: 'wind' };
  // Its frame 1 is this frame: think() advances it like any action. It lasts until updateBoss() unlocks it.
  boss.action = 'bossAttack';
  boss.actionFrame = 0;
  boss.actionLength = 0;
  boss.vx = 0;
  boss.contact = null;
}

/**
 * Where the attack is (for the renderer and the tests): the telegraph, the active part (the boss swinging, slamming,
 * charging, pulling, the sphere hurting, or the meteor rain), then the recovery (what is left fades away).
 */
export function bossStage(a: BossAttack): BossStage {
  const t = BOSS_ATTACK[a.id].telegraph;
  if (a.frame <= t) return 'telegraph';
  const activeUntil: Record<Exclude<BossAttackId, 'rampage'>, number> = {
    slash: t + SLASH.swing,
    nova: t + NOVA.grow + NOVA.linger,
    meteor: t + METEOR.rain,
    quake: t + QUAKE.gap + 1,
    vortex: t + VORTEX.pullFrames + VORTEX.active,
  };
  if (a.id === 'rampage') return a.run === 'recover' ? 'recovery' : 'active';
  return a.frame <= activeUntil[a.id] ? 'active' : 'recovery';
}

/** The nova's radius (sub-pixels) on an attack frame: it grows fast, then slows (ease-out). */
export function novaRadius(frame: number): number {
  const t = BOSS_ATTACK.nova.telegraph;
  if (frame <= t) return 0;
  const p = Math.min(1, (frame - t) / NOVA.grow);
  return Math.round(NOVA.startRadius + (NOVA.radius - NOVA.startRadius) * (1 - (1 - p) ** 2));
}

/** A circle around the boss's body (its center is at mid-height) touching a box. */
function circleTouches(cx: number, radius: number, b: WorldBox): boolean {
  const cy = BODY_HEIGHT / 2;
  const nx = Math.max(b.x1, Math.min(cx, b.x2));
  const ny = Math.max(b.y1, Math.min(cy, b.y2));
  return (nx - cx) ** 2 + (ny - cy) ** 2 < radius ** 2;
}

const clampToStage = (x: number) => Math.min(STAGE_WIDTH - BODY_HALF_WIDTH, Math.max(BODY_HALF_WIDTH, x));
const offStage = (x: number) => x < -px(80) || x > STAGE_WIDTH + px(80);
const awayFrom = (x: number, foe: Fighter, fallback: number) => (foe.x === x ? fallback : Math.sign(foe.x - x));

/** The box a meteor's impact covers. */
export const meteorBox = (m: BossPart): WorldBox => ({ x1: m.x - METEOR.halfWidth, x2: m.x + METEOR.halfWidth, y1: 0, y2: METEOR.height });
/** The box of a shockwave along the floor. */
export const shockBox = (s: BossPart): WorldBox => ({ x1: s.x - QUAKE.halfWidth, x2: s.x + QUAKE.halfWidth, y1: 0, y2: QUAKE.height });
/** The charging boss's box. */
export const rampageBox = (boss: Fighter): WorldBox => ({ x1: boss.x - RAMPAGE.halfWidth, x2: boss.x + RAMPAGE.halfWidth, y1: 0, y2: RAMPAGE.height });

/**
 * After the fighters moved: advances the boss's attack (its parts move, the boss charges, the opponent is pulled) and
 * returns what connects this frame.
 */
export function updateBoss(state: FightState, boss: Fighter, events: FightEvent[]): BossHit[] {
  const b = boss.boss;
  const a = b?.current;
  if (!b || !a) return [];
  // A K.O. (either side) ends everything on screen.
  if (state.winner !== null || boss.action === 'ko') {
    b.current = null;
    // A boss still standing (it won, or time ran out) stops where it is.
    if (boss.action === 'bossAttack') unlock(boss);
    events.push({ type: 'bossAttack', fighter: boss.id, attack: a.id, phase: 'end' });
    return [];
  }
  const foe = foeOf(state, boss);
  const t = BOSS_ATTACK[a.id].telegraph;
  a.frame++;
  if (a.frame === 1) events.push({ type: 'bossAttack', fighter: boss.id, attack: a.id, phase: 'telegraph' });
  if (a.frame === t + 1) {
    a.dir = awayFrom(boss.x, foe, boss.facing) as 1 | -1;
    events.push({ type: 'bossAttack', fighter: boss.id, attack: a.id, phase: 'active' });
  }
  const hits: BossHit[] = [];
  const canHit = foe.action !== 'ko' && foe.hp > 0;
  const touchable = canHit && !isInvincible(foe);
  const hit = (away: number) => hits.push({ boss: boss.id, attack: a.id, away });
  let lockEnd: number;
  let done: boolean;

  switch (a.id) {
    case 'slash': {
      if (a.frame === t + 1) {
        boss.facing = a.dir;
        a.parts.push({ kind: 'wave', x: boss.x, dir: a.dir, born: a.frame, land: 0, hit: false });
      }
      for (const wave of a.parts) {
        wave.x += wave.dir * SLASH.speed;
        // It can't be avoided: it sweeps the whole height of the screen, and a back dash's few invincible frames
        // don't get through a wave this wide either. Only a guard (on the ground) softens it.
        if (!wave.hit && canHit && wave.dir * (foe.x - wave.x) <= 0) {
          wave.hit = true;
          hit(wave.dir);
        }
      }
      a.parts = a.parts.filter(p => !offStage(p.x));
      lockEnd = t + SLASH.swing + SLASH.recovery;
      done = a.frame >= lockEnd && a.parts.length === 0;
      break;
    }
    case 'nova': {
      const hurts = a.frame > t && a.frame <= t + NOVA.grow + NOVA.linger;
      if (hurts && !a.hit && touchable && circleTouches(a.x, novaRadius(a.frame), bodyBox(foe))) {
        a.hit = true;
        hit(awayFrom(a.x, foe, boss.facing));
      }
      lockEnd = t + NOVA.grow + NOVA.linger + NOVA.recovery;
      done = a.frame >= Math.max(lockEnd, t + NOVA.grow + NOVA.linger + NOVA.fade);
      break;
    }
    case 'meteor': {
      const rainEnd = t + METEOR.rain;
      if (a.frame === t + 1) a.mark = a.frame;
      if (a.frame === a.mark && a.frame + METEOR.warning <= rainEnd) {
        const rng = createRng(b.rng);
        // Every other one falls near the opponent (so standing still never works), the rest anywhere.
        const x = a.count % 2 === 0 ? foe.x - METEOR.aim + rng.int(2 * METEOR.aim + 1) : px(24) + rng.int(STAGE_WIDTH - px(48) + 1);
        b.rng = rng.state;
        a.parts.push({ kind: 'meteor', x: Math.min(STAGE_WIDTH - px(12), Math.max(px(12), x)), dir: 0, born: a.frame, land: a.frame + METEOR.warning, hit: false });
        a.count++;
        a.mark += b.enraged ? METEOR.enragedEvery : METEOR.every;
      }
      for (const m of a.parts) {
        if (a.frame === m.land) events.push({ type: 'bossImpact', fighter: boss.id, attack: a.id, x: m.x });
        const live = a.frame >= m.land && a.frame < m.land + METEOR.active;
        if (live && !m.hit && touchable && overlaps(meteorBox(m), bodyBox(foe))) {
          m.hit = true;
          hit(awayFrom(m.x, foe, 1));
        }
      }
      a.parts = a.parts.filter(m => a.frame < m.land + METEOR.linger);
      lockEnd = t + METEOR.cast;
      // Nothing lands after the 5 s; the last blast fades, and it is over.
      done = a.frame >= rainEnd + METEOR.linger;
      break;
    }
    case 'quake': {
      if (a.frame === t + 1 || a.frame === t + 1 + QUAKE.gap) {
        events.push({ type: 'bossImpact', fighter: boss.id, attack: a.id, x: boss.x });
        for (const dir of [-1, 1] as const) a.parts.push({ kind: 'shock', x: boss.x, dir, born: a.frame, land: 0, hit: false });
      }
      for (const s of a.parts) {
        s.x += s.dir * QUAKE.speed;
        if (!s.hit && touchable && overlaps(shockBox(s), bodyBox(foe))) {
          s.hit = true;
          hit(s.dir);
        }
      }
      // Each wave runs a whole screen's width (80 frames), then dies out: the attack always lasts the same.
      a.parts = a.parts.filter(p => a.frame - p.born < QUAKE.range);
      lockEnd = t + QUAKE.gap + QUAKE.recovery;
      done = a.frame >= t + 1 + QUAKE.gap + QUAKE.range;
      break;
    }
    case 'rampage': {
      if (a.frame === t + 1) {
        a.run = 'run';
        boss.facing = a.dir;
      }
      if (a.run === 'run') {
        const wall = a.dir === 1 ? STAGE_WIDTH - BODY_HALF_WIDTH : BODY_HALF_WIDTH;
        boss.x = clampToStage(boss.x + a.dir * RAMPAGE.speed);
        if (!a.hit && touchable && overlaps(rampageBox(boss), bodyBox(foe))) {
          a.hit = true;
          hit(a.dir);
        }
        if (boss.x === wall) {
          a.run = a.count === 0 ? 'turn' : 'recover';
          a.mark = a.frame;
        }
      } else if (a.run === 'turn' && a.frame - a.mark >= RAMPAGE.turn) {
        // Back the other way: a new pass, a new chance to hit.
        a.run = 'run';
        a.count = 1;
        a.dir = -a.dir as 1 | -1;
        a.hit = false;
        boss.facing = a.dir;
      }
      done = a.run === 'recover' && a.frame - a.mark >= RAMPAGE.recovery;
      lockEnd = done ? a.frame : Infinity;
      break;
    }
    case 'vortex': {
      const burst = t + VORTEX.pullFrames + 1;
      if (a.frame > t && a.frame < burst && canHit) {
        // Pulled towards the boss (up to a little in front of it): walking away is just faster than the pull.
        const gap = a.x - foe.x;
        if (Math.abs(gap) > VORTEX.keep) foe.x = clampToStage(foe.x + Math.sign(gap) * Math.min(VORTEX.pull, Math.abs(gap) - VORTEX.keep));
      }
      if (a.frame === burst) events.push({ type: 'bossImpact', fighter: boss.id, attack: a.id, x: a.x });
      const live = a.frame >= burst && a.frame < burst + VORTEX.active;
      if (live && !a.hit && touchable && circleTouches(a.x, VORTEX.radius, bodyBox(foe))) {
        a.hit = true;
        hit(awayFrom(a.x, foe, boss.facing));
      }
      lockEnd = burst + VORTEX.active + VORTEX.recovery - 1;
      done = a.frame >= lockEnd;
      break;
    }
  }

  if (a.locked && a.frame >= lockEnd) {
    a.locked = false;
    if (boss.action === 'bossAttack') unlock(boss);
  }
  if (done) {
    b.current = null;
    const rng = createRng(b.rng);
    b.wait = between(rng, b.enraged ? BOSS_SCHEDULE.enraged : BOSS_SCHEDULE.wait);
    b.rng = rng.state;
    events.push({ type: 'bossAttack', fighter: boss.id, attack: a.id, phase: 'end' });
  }
  return hits;
}

/** The boss is free again, like at the end of any action. */
function unlock(boss: Fighter) {
  boss.action = 'idle';
  boss.actionFrame = 1;
  boss.actionLength = 0;
}

/**
 * What a boss attack does to HP: its power, the boss's own (first) type and the attack's category. A legendary's
 * attacks are never fully nullified: against a type immune to the boss's (a Ghost against a Normal boss), they hit
 * typeless instead, so an "unavoidable" attack stays a threat for every team.
 */
export function bossAttackInfo(boss: Fighter, defender: Fighter, id: BossAttackId): AttackInfo {
  const { power, category } = BOSS_ATTACK[id];
  const type = boss.types[0] ?? null;
  return { power, category, type: type && effectiveness(type, defender.types) > 0 ? type : null };
}
