// Collision boxes in world coordinates (sub-pixels), and which move a fighter is doing.
//   - Hurt box: where a fighter can be hit (its body).
//   - Hit box: where an attack hits, only on its active frames (melee, beams, rushes).
//   - Push box: what keeps two fighters from overlapping (the body too, for now).
//   - Projectiles carry their own box.

import { BODY_HALF_WIDTH, BODY_HEIGHT, STAGE_HEIGHT } from './constants';
import { AIR_PHYSICAL, BACKDASH, BIG, ELEMENTAL, PHYSICAL, signatureMove, type BigShape, type Box, type MoveData } from './frame-data';
import type { ActionKind, BigKind, Fighter, Loadout, Projectile } from './state';

/** Same shape as Box, but in world coordinates (x1 < x2, y1 < y2). */
export type WorldBox = Box;

export function bodyBox(f: Fighter): WorldBox {
  return { x1: f.x - BODY_HALF_WIDTH, x2: f.x + BODY_HALF_WIDTH, y1: f.y, y2: f.y + BODY_HEIGHT };
}

export function projectileBox(p: Projectile): WorldBox {
  return { x1: p.x - p.halfWidth, x2: p.x + p.halfWidth, y1: p.y1, y2: p.y2 };
}

/** Turns a box relative to the fighter (x forward) into world coordinates. */
export function toWorld(f: Fighter, b: Box): WorldBox {
  const [x1, x2] = f.facing === 1 ? [f.x + b.x1, f.x + b.x2] : [f.x - b.x2, f.x - b.x1];
  return { x1, x2, y1: f.y + b.y1, y2: f.y + b.y2 };
}

export const overlaps = (a: WorldBox, b: WorldBox) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** The move an action does, if any (specials depend on the Pokémon's loadout). */
export function moveOf(action: ActionKind, loadout: Loadout): MoveData | null {
  switch (action) {
    case 'attack':
      return PHYSICAL;
    case 'airAttack':
      return AIR_PHYSICAL;
    case 'elemental':
      return ELEMENTAL[loadout.elemental.shape];
    case 'big':
      return BIG[loadout.big.shape];
    default:
      return null;
  }
}

/** What a 'big' action is: its type, power, category and form (the big special, a signature or a legendary move). */
export function activeBig(f: Pick<Fighter, 'loadout' | 'bigKind'>): { type: string; power: number; category: 'physical' | 'special'; shape: BigShape } {
  const { signature, legend, big } = f.loadout;
  if (f.bigKind === 'signature' && signature) return signature;
  // A legendary move's power: it hits as a big special does (fight/damage.ts bigDamage), scaled by the PP paid.
  if (f.bigKind === 'legend' && legend) return { ...legend, power: 100 };
  return big;
}

/** The move the fighter is doing, if any. */
export function currentMove(f: Fighter): MoveData | null {
  if (f.action !== 'big') return moveOf(f.action, f.loadout);
  const { shape } = activeBig(f);
  return f.bigKind === 'signature' ? signatureMove(shape) : BIG[shape];
}

export type { BigKind };

export type MovePhase = 'startup' | 'active' | 'recovery';

export function movePhase(move: MoveData, frame: number): MovePhase {
  if (frame <= move.startup) return 'startup';
  if (frame <= move.startup + move.active) return 'active';
  return 'recovery';
}

/** The hit box of the fighter's move, if it is on an active frame (a strike's is a column on its locked spot). */
export function activeHitbox(f: Fighter): WorldBox | null {
  const move = currentMove(f);
  if (!move || movePhase(move, f.actionFrame) !== 'active') return null;
  if (move.strike) return f.target === null ? null : strikeBox(f.target, move.strike.halfWidth);
  return move.hitbox ? toWorld(f, move.hitbox) : null;
}

/** A strike's column: the whole height of the stage, on its spot. */
export const strikeBox = (x: number, halfWidth: number): WorldBox => ({ x1: x - halfWidth, x2: x + halfWidth, y1: 0, y2: STAGE_HEIGHT });

export function isInvincible(f: Fighter): boolean {
  return f.action === 'ko' || (f.action === 'backdash' && f.actionFrame <= BACKDASH.invincibleUntil);
}

/** Guarding on the ground blocks everything, from both sides. */
export function isGuarding(f: Fighter): boolean {
  return (f.action === 'guard' || f.action === 'blockstun') && f.y === 0;
}

/** Fighters that pass through the other: knocked out, dashing, rushing, or a boss on a rampage. */
export function passesThrough(f: Fighter): boolean {
  return (
    f.action === 'ko' ||
    f.action === 'dash' ||
    (f.action === 'big' && activeBig(f).shape === 'rush') ||
    (f.action === 'bossAttack' && f.boss?.current?.id === 'rampage')
  );
}
