// Frame data: how long every action takes, where attacks hit and what a hit does. These are the numbers to tune by
// playing with the debug overlay (F1). The tests pin them, so a change here is always on purpose.
//
// Frame counting: the frame an action starts on is its frame 1. An attack with startup 5 hits from frame 6.
// For specials, "startup" is the charge. A fighter that gets hit starts its hitstun on the next frame.
// Damage is not here: it comes from the official formula when a hit lands (fight/damage.ts), from the move's power
// (the tackle's below, specials' from the Pokémon's moves) and both Pokémon's stats and types.

import { px } from './constants';

/** A rectangle relative to the fighter: x is forward from its center, y is up from its feet (sub-pixels). */
export interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

const box = (x1: number, x2: number, y1: number, y2: number): Box => ({ x1: px(x1), x2: px(x2), y1: px(y1), y2: px(y2) });

/** What a move does when it connects (besides damage). */
export interface HitData {
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
  /** One goes each way (the quake's ground waves). */
  bothWays?: boolean;
}

/**
 * Several projectiles thrown in arcs (rocks, meteors), each landing `distances` in front of the attacker after `flight`
 * frames. Each one hits with `hit` and a `share` of the big special's damage; it is gone once it sinks into the floor.
 */
export interface BarrageData {
  distances: readonly number[];
  flight: number;
  /** Height they are thrown from, above the attacker's feet. */
  fromY: number;
  halfWidth: number;
  height: number;
  gravity: number;
  share: number;
  hit: HitData;
}

/** A strike on the opponent's spot (lightning from the sky, a shadow from the ground): it locks on during the charge. */
export interface StrikeData {
  /** The charge frame the spot is locked on (the opponent's position then). */
  lockAt: number;
  halfWidth: number;
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
  /** Thrown on the first active frame. */
  barrage?: BarrageData;
  /** Hits the locked spot on its active frames (instead of a hitbox). */
  strike?: StrikeData;
}

export const moveLength = (move: MoveData) => move.startup + move.active + move.recovery;

// ── Physical ──────────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The tackle has no type: always neutral, no STAB (decided in milestone 4). Otherwise a Ghost could never be tackled,
 * and a Normal-type knowing only Normal moves could never win against one. The specials carry the type game.
 */
export const PHYSICAL_POWER = 40;
export const AIR_PHYSICAL_POWER = 35;

/** J on the ground: the tackle. A short lunge with a quick hit. +3 on hit, -1 on block. */
export const PHYSICAL: MoveData = {
  startup: 5,
  active: 4,
  recovery: 12,
  hit: { hitstun: 18, blockstun: 14, knockback: px(3), hitstop: 6, ppGain: 15, chip: false, big: false },
  hitbox: box(10, 46, 18, 40),
  lunge: { until: 9, speed: px(1.5) },
};

/** J in the air: hits forward and down, good for jumping in. One air move per jump. */
export const AIR_PHYSICAL: MoveData = {
  startup: 4,
  active: 6,
  recovery: 0,
  hit: { hitstun: 18, blockstun: 14, knockback: px(2), hitstop: 6, ppGain: 15, chip: false, big: false },
  hitbox: box(4, 34, -6, 26),
};

// ── Specials ──────────────────────────────────────────────────────────────────────────────────────────────────────

export type ElementalShape = 'projectile' | 'beam';
/** The big special's forms (plan.md §4.9): each type has one (game/moves.ts), and each hits the way it looks. */
export type BigShape = 'projectile' | 'beam' | 'rush' | 'quake' | 'surf' | 'tornado' | 'solar' | 'blizzard' | 'burst' | 'strike' | 'barrage';
export type SpecialSlot = 'elemental' | 'big';

const BIG_LAUNCH = { vy: px(5), push: px(3) };

/** K: always a range attack. Costs ¼ of the PP bar. Also in the air. */
export const ELEMENTAL: Record<ElementalShape, MoveData> = {
  projectile: {
    startup: 14,
    active: 1,
    recovery: 18,
    hit: { hitstun: 18, blockstun: 16, knockback: px(3), hitstop: 6, ppGain: 5, chip: true, big: false },
    projectile: { speed: px(4), halfWidth: px(8), y1: px(18), y2: px(34), spawnX: px(24) },
  },
  beam: {
    startup: 14,
    active: 6,
    recovery: 18,
    hit: { hitstun: 18, blockstun: 16, knockback: px(2), hitstop: 6, ppGain: 5, chip: true, big: false },
    hitbox: box(16, 216, 20, 32),
  },
};

const BIG_HIT: HitData = { hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true };

/** I: needs and spends the full PP bar. Long charge, knocks down. Ground only. Uses the move's own power (strong moves
 * are already 90–120; doubling it made a super-effective big special a one-hit KO). Every form has the same 40-frame
 * charge and 30 frames of recovery: the charge is the risk, the form is how to survive it. */
export const BIG: Record<BigShape, MoveData> = {
  projectile: {
    startup: 40,
    active: 1,
    recovery: 30,
    hit: { hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true },
    projectile: { speed: px(6), halfWidth: px(16), y1: px(6), y2: px(46), spawnX: px(32) },
  },
  beam: {
    startup: 40,
    active: 10,
    recovery: 30,
    hit: { hitstun: 30, blockstun: 24, knockback: px(3), hitstop: 14, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true },
    hitbox: box(16, 480, 10, 42),
  },
  /** The "big dash": a physical charge through the opponent (Take Down, Body Slam…). */
  rush: {
    startup: 40,
    active: 24,
    recovery: 30,
    hit: { hitstun: 30, blockstun: 24, knockback: px(4), hitstop: 14, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true },
    hitbox: box(-8, 30, 4, 44),
    rush: { speed: px(9) },
  },
  /** Ground: a wave along the floor each way, to both edges. Jump it. */
  quake: {
    startup: 40,
    active: 1,
    recovery: 30,
    hit: BIG_HIT,
    projectile: { speed: px(5), halfWidth: px(10), y1: 0, y2: px(16), spawnX: px(20), bothWays: true },
  },
  /** Water (Surf), Poison (Sludge Wave): a wide, tall, slow wave. Guard it (a jump clears it only at its very top). */
  surf: {
    startup: 40,
    active: 1,
    recovery: 30,
    hit: BIG_HIT,
    projectile: { speed: px(3.5), halfWidth: px(22), y1: 0, y2: px(72), spawnX: px(30) },
  },
  /** Fire (Fire Spin), Flying (Hurricane): a column taller than any jump, crossing slowly. Guard it. */
  tornado: {
    startup: 40,
    active: 1,
    recovery: 30,
    hit: BIG_HIT,
    projectile: { speed: px(2.5), halfWidth: px(14), y1: 0, y2: px(150), spawnX: px(36) },
  },
  /** Grass (Solar Beam): a huge beam across the screen, from the floor up. Only a jump's top clears it. */
  solar: {
    startup: 40,
    active: 12,
    recovery: 30,
    hit: { ...BIG_HIT, knockback: px(3) },
    hitbox: box(16, 480, 0, 64),
  },
  /** Ice: a storm over a big area in front. Back off, or guard. */
  blizzard: {
    startup: 40,
    active: 18,
    recovery: 30,
    hit: BIG_HIT,
    hitbox: box(0, 170, 0, 80),
  },
  /** Psychic, Dark, Fairy: a sphere all around the attacker, behind it too. Stay away, or guard. */
  burst: {
    startup: 40,
    active: 8,
    recovery: 30,
    hit: BIG_HIT,
    hitbox: box(-95, 95, 0, 95),
  },
  /** Electric (Thunder, from the sky), Ghost (from the ground): on the opponent's spot, locked 12 frames before. Move. */
  strike: {
    startup: 40,
    active: 6,
    recovery: 30,
    hit: BIG_HIT,
    strike: { lockAt: 28, halfWidth: px(18) },
  },
  /** Rock (Rock Slide), Dragon (Draco Meteor): three in arcs, landing 70, 130 and 190 px ahead. Stand between them. */
  barrage: {
    startup: 40,
    active: 1,
    recovery: 30,
    hit: BIG_HIT,
    barrage: {
      distances: [px(70), px(130), px(190)],
      flight: 30,
      fromY: px(30),
      halfWidth: px(9),
      height: px(18),
      gravity: px(0.5),
      share: 0.4,
      hit: { hitstun: 24, blockstun: 18, knockback: px(3), hitstop: 10, ppGain: 0, chip: true, launch: BIG_LAUNCH, big: true },
    },
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

/**
 * A dash through the opponent (decided after milestone 13, to make dashing worth it): the dasher's first hit within
 * `window` frames after the dash ends does `multiplier` × ("Back attack!"). Only the first one, hit or blocked.
 */
export const BACK_ATTACK = { window: 30, multiplier: 1.5 };

/**
 * Parry (decided after milestone 13): guard pressed (a fresh press, not held) at most `window` frames before a hit
 * lands. No damage, no chip; both freeze `hitstop` frames; a melee attacker is stuck `stun` frames (in reach of a
 * tackle), and the parrier's first hit within `counter` frames does `multiplier` × ("Counter!"). Holding guard is an
 * ordinary guard, and letting go of it takes GUARD.release frames, so mashing doesn't parry.
 */
export const PARRY = { window: 6, hitstop: 12, stun: 20, counter: 24, multiplier: 1.5 };

/** A fighter hit in the air pops up, falls, and stays down for a moment after landing. */
export const AIR_HIT = { launch: px(3), push: px(2), knockdown: 20 };

/** The knocked-out fighter is thrown back a little. */
export const KO_POP = { launch: px(3), push: px(2) };
