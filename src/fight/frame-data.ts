// Frame data: how long every action takes and where attacks hit. These are the numbers to tune by playing with the
// debug overlay (F1). The tests pin them, so a change here is always on purpose.
//
// Frame counting: the frame an action starts on is its frame 1. An attack with startup 5 hits from frame 6.
// A fighter that gets hit starts its hitstun on the next frame.

import { px } from './constants';

/** A rectangle relative to the fighter: x is forward from its center, y is up from its feet (sub-pixels). */
export interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

const box = (x1: number, x2: number, y1: number, y2: number): Box => ({ x1: px(x1), x2: px(x2), y1: px(y1), y2: px(y2) });

export interface AttackData {
  startup: number;
  active: number;
  /** Frames after the active ones. Air attacks have none: they last until the fighter lands. */
  recovery: number;
  damage: number;
  /** Hitstun of a grounded opponent. */
  hitstun: number;
  /** Speed the grounded opponent is pushed back with (it slows down to a stop). */
  knockback: number;
  hitbox: Box;
  /** The attacker moves forward on frames 1..until (the "lunge" into the opponent). */
  lunge?: { until: number; speed: number };
}

/** J on the ground: a short lunge with a quick hit. +3 on hit, so the attacker keeps the initiative. */
export const PHYSICAL: AttackData = {
  startup: 5,
  active: 4,
  recovery: 12,
  damage: 80,
  hitstun: 18,
  knockback: px(3),
  hitbox: box(10, 46, 18, 40),
  lunge: { until: 9, speed: px(1.5) },
};

/** J in the air: hits forward and down, good for jumping in. One per jump. */
export const AIR_PHYSICAL: AttackData = {
  startup: 4,
  active: 6,
  recovery: 0,
  damage: 70,
  hitstun: 18,
  knockback: px(2),
  hitbox: box(4, 34, -6, 26),
};

export const attackLength = (attack: AttackData) => attack.startup + attack.active + attack.recovery;

export const WALK = { forward: px(2), back: px(1.75) };

/**
 * Jump: 3 grounded frames, then 36 frames in the air (apex 85.5 px, on frames 18–19), then 2 landing frames.
 * The direction is the one held on the last grounded frame.
 */
export const JUMP = {
  prejump: 3,
  launchSpeed: px(9),
  gravity: px(0.5),
  forwardSpeed: px(2.5),
  backSpeed: px(2),
  landing: 2,
};

/** Double-tap forward. */
export const DASH = { startup: 2, moving: 14, recovery: 4, speed: px(5) };

/** Double-tap back. Can't be hit on its first frames, but can be punished at the end. */
export const BACKDASH = { startup: 2, moving: 14, recovery: 4, speed: px(4.5), invincibleUntil: 6 };

export const dashLength = (dash: typeof DASH) => dash.startup + dash.moving + dash.recovery;

/** A fighter hit in the air pops up, falls, and stays down for a moment after landing. */
export const AIR_HIT = { launch: px(3), push: px(2), knockdown: 20 };

/** The knocked-out fighter is thrown back a little. */
export const KO_POP = { launch: px(3), push: px(2) };
