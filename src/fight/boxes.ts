// Collision boxes in world coordinates (sub-pixels).
//   - Hurt box: where a fighter can be hit (its body).
//   - Hit box: where an attack hits, only on its active frames.
//   - Push box: what keeps two fighters from overlapping (the body too, for now).

import { BODY_HALF_WIDTH, BODY_HEIGHT } from './constants';
import { AIR_PHYSICAL, BACKDASH, PHYSICAL, type AttackData, type Box } from './frame-data';
import type { Fighter } from './state';

/** Same shape as Box, but in world coordinates (x1 < x2, y1 < y2). */
export type WorldBox = Box;

export function bodyBox(f: Fighter): WorldBox {
  return { x1: f.x - BODY_HALF_WIDTH, x2: f.x + BODY_HALF_WIDTH, y1: f.y, y2: f.y + BODY_HEIGHT };
}

/** Turns a box relative to the fighter (x forward) into world coordinates. */
export function toWorld(f: Fighter, b: Box): WorldBox {
  const [x1, x2] = f.facing === 1 ? [f.x + b.x1, f.x + b.x2] : [f.x - b.x2, f.x - b.x1];
  return { x1, x2, y1: f.y + b.y1, y2: f.y + b.y2 };
}

export const overlaps = (a: WorldBox, b: WorldBox) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

export function currentAttack(f: Fighter): AttackData | null {
  if (f.action === 'attack') return PHYSICAL;
  if (f.action === 'airAttack') return AIR_PHYSICAL;
  return null;
}

export type AttackPhase = 'startup' | 'active' | 'recovery';

export function attackPhase(attack: AttackData, frame: number): AttackPhase {
  if (frame <= attack.startup) return 'startup';
  if (frame <= attack.startup + attack.active) return 'active';
  return 'recovery';
}

/** The hit box of the fighter's attack, if it is on an active frame. */
export function activeHitbox(f: Fighter): WorldBox | null {
  const attack = currentAttack(f);
  if (!attack || attackPhase(attack, f.actionFrame) !== 'active') return null;
  return toWorld(f, attack.hitbox);
}

export function isInvincible(f: Fighter): boolean {
  return f.action === 'ko' || (f.action === 'backdash' && f.actionFrame <= BACKDASH.invincibleUntil);
}
