// Frame data: how long every action takes, where attacks hit and what a hit does. These are the numbers to tune by
// playing with the debug overlay (F1). The tests pin them, so a change here is always on purpose.
//
// Frame counting: the frame an action starts on is its frame 1. An attack with startup 5 hits from frame 6.
// For specials, "startup" is the charge. A fighter that gets hit starts its hitstun on the next frame.
// Damage values are placeholders (out of 1000 HP) until Pokémon stats and the damage formula arrive (milestone 4).

import { px } from './constants';

/** A rectangle relative to the fighter: x is forward from its center, y is up from its feet (sub-pixels). */
export interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

const box = (x1: number, x2: number, y1: number, y2: number): Box => ({ x1: px(x1), x2: px(x2), y1: px(y1), y2: px(y2) });

/** What a move does when it connects. */
export interface HitData {
  damage: number;
  /** Hitstun of a grounded opponent (moves with `launch` knock down instead). */
  hitstun: number;
  blockstun: number;
  /** Speed a grounded opponent is pushed back with, on hit or on block (it slows down to a stop). */
  knockback: number;
  hitstop: number;
  /** PP the attacker earns when the move lands (not when it is guarded). */
  ppGain: number;
  /** Specials do a little damage through a guard ("chip"); physical attacks don't. */
  chip: boolean;
  /** Knocks the opponent into the air (big specials). */
  launch?: { vy: number; push: number };
  big: boolean;
}

export interface ProjectileData {
  speed: number;
  halfWidth: number;
  /** Height band, from the fighter's feet. */
  y1: number;
  y2: number;
  /** Where it appears, in front of the fighter's center. */
  spawnX: number;
}

export interface MoveData {
  /** For specials, the charge. */
  startup: number;
  active: number;
  /** Frames after the active ones. Air moves have none: they last until the fighter lands. */
  recovery: number;
  hit: HitData;
  /** Melee attacks, beams and rushes hit with a box; projectiles carry their own. */
  hitbox?: Box;
  /** The attacker moves forward on frames 1..until (the tackle's lunge). */
  lunge?: { until: number; speed: number };
  /** The attacker charges across the screen on its active frames, through the opponent. */
  rush?: { speed: number };
  /** Fired on the first active frame. */
  projectile?: ProjectileData;
}

export const moveLength = (move: MoveData) => move.startup + move.active + move.recovery;

// ── Physical ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** J on the ground: the tackle. A short lunge with a quick hit. +3 on hit, -1 on block. */
export const PHYSICAL: MoveData = {
  startup: 5,
  active: 4,
  recovery: 12,
  hit: { damage: 80, hitstun: 18, blockstun: 14, knockback: px(3), hitstop: 6, ppGain: 15, chip: false, big: false },
  hitbox: box(10, 46, 18, 40),
  lunge: { until: 9, speed: px(1.5) },
};

/** J in the air: hits forward and down, good for jumping in. One air move per jump. */
export const AIR_PHYSICAL: MoveData = {
  startup: 4,
  active: 6,
  recovery: 0,
  hit: { damage: 70, hitstun: 18, blockstun: 14, knockback: px(2), hitstop: 6, ppGain: 15, chip: false, big: false },
  hitbox: box(4, 34, -6, 26),
};

// ── Specials ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type ElementalShape = 'projectile' | 'beam';
export type BigShape = 'projectile' | 'beam' | 'rush';
export type SpecialSlot = 'elemental' | 'big';

const BIG_LAUNCH = { vy: px(5), push: px(3) };

/** K: always a range attack. Costs ¼ of the PP bar. Also in the air. */
export const ELEMENTAL: Record<ElementalShape, MoveData> = {
  projectile: {
    startup: 14,
    active: 1,
    recovery: 18,
    hit: { damage: 60, hitstun: 18, blockstun: 16, knockback: px(3), hitstop: 6, ppGain: 5, chip: true, big: false },
    projectile: { speed: px(4), halfWidth: px(8), y1: px(18), y2: px(34), spawnX: px(24) },
  },
  beam: {
    startup: 14,
    active: 6,
    recovery: 18,
    hit: { damage: 50, hitstun: 18, blockstun: 16, knockback: px(2), hitstop: 6, ppGain: 5, chip: true, big: false },
    hitbox: box(16, 216, 20, 32),
  },
};

/** I: needs and spends the full PP bar. Long charge, big damage, knocks down. Ground only. */
export const BIG: Record<BigShape, MoveData> = {
  projectile: {
    startup: 40,
    active: 1,
    recovery: 30,
    hit: { damage: 220, hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true },
    projectile: { speed: px(6), halfWidth: px(16), y1: px(6), y2: px(46), spawnX: px(32) },
  },
  beam: {
    startup: 40,
    active: 10,
    recovery: 30,
    hit: { damage: 200, hitstun: 30, blockstun: 24, knockback: px(3), hitstop: 14, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true },
    hitbox: box(16, 480, 10, 42),
  },
  /** The "big dash": a physical charge through the opponent (Take Down, Body Slam…). */
  rush: {
    startup: 40,
    active: 24,
    recovery: 30,
    hit: { damage: 250, hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true },
    hitbox: box(-8, 30, 4, 44),
    rush: { speed: px(9) },
  },
};

// ── Movement ──────────────────────────────────────────────────────────────────────────────────────────────────────

export const WALK = { forward: px(2), back: px(1.75) };

/**
 * Jump: 3 grounded frames, then 36 frames in the air (apex 85.5 px, on frames 18–19), then 2 landing frames.
 * It starts in the direction held on the last grounded frame.
 */
export const JUMP = {
  prejump: 3,
  launchSpeed: px(9),
  gravity: px(0.5),
  forwardSpeed: px(2.5),
  backSpeed: px(2),
  landing: 2,
};

/**
 * Air control: holding left or right in the air steers towards that direction's jump speed, changing by `accel`
 * per frame (0 → full speed in 5 frames). With no direction held, the jump keeps its speed.
 */
export const AIR_CONTROL = { accel: px(0.5) };

/** Dash button (Space / LB), forward. Passes through the opponent. */
export const DASH = { startup: 2, moving: 14, recovery: 4, speed: px(5) };

/** Dash button + back. Can't be hit on its first frames, but can be punished at the end. */
export const BACKDASH = { startup: 2, moving: 14, recovery: 4, speed: px(4.5), invincibleUntil: 6 };

export const dashLength = (dash: typeof DASH) => dash.startup + dash.moving + dash.recovery;

/** Guard (L / RB, held): blocks everything on the ground. Letting go takes a few frames. */
export const GUARD = { release: 3 };

/** A fighter hit in the air pops up, falls, and stays down for a moment after landing. */
export const AIR_HIT = { launch: px(3), push: px(2), knockdown: 20 };

/** The knocked-out fighter is thrown back a little. */
export const KO_POP = { launch: px(3), push: px(2) };
