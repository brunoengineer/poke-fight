// One frame of the fight: step(state, inputs) → new state + events. Pure: same state + same inputs = same result.
//
// Order of a frame:
//   1. Read inputs (new presses go into the buffer). During hitstop only this happens: presses are kept.
//   2. Each fighter advances its action and, if it can act, picks a new one (both decide from the same positions).
//   3. Movement and gravity.
//   4. Push boxes keep the fighters apart, walls keep them in the arena.
//   5. Hits: both attacks are checked before either is applied, so two hits on the same frame trade.

import { activeHitbox, bodyBox, currentAttack, isInvincible, overlaps } from './boxes';
import { BODY_HALF_WIDTH, BODY_HEIGHT, BUFFER_FRAMES, HITSTOP, STAGE_WIDTH } from './constants';
import { AIR_CONTROL, AIR_HIT, BACKDASH, DASH, JUMP, KO_POP, PHYSICAL, WALK, attackLength, dashLength } from './frame-data';
import { Button, cleanDirections, has, type InputMask } from './input';
import { type ActionKind, type FightEvent, type FightState, type Fighter } from './state';

export interface StepResult {
  state: FightState;
  events: FightEvent[];
}

export function step(previous: FightState, inputs: readonly [InputMask, InputMask]): StepResult {
  const state = structuredClone(previous);
  const events: FightEvent[] = [];
  state.frame++;

  // After a KO nobody controls anything; the bodies still fall and slide.
  const masks = state.winner === null ? inputs.map(cleanDirections) : [0, 0];
  state.fighters.forEach((f, i) => readInput(f, masks[i]));

  if (state.hitstop > 0) {
    state.hitstop--;
    return { state, events };
  }

  const [a, b] = state.fighters;
  // Both decide from the positions at the start of the frame, so player 1 has no advantage over player 2.
  const startX = [a.x, b.x];
  think(a, startX[1]);
  think(b, startX[0]);
  move(a);
  move(b);
  separate(a, b);
  resolveHits(state, events);
  return { state, events };
}

// ── 1. Input ──────────────────────────────────────────────────────────────────────────────────────────────────────

function readInput(f: Fighter, mask: InputMask) {
  const pressed = mask & ~f.held;
  f.held = mask;
  if (has(pressed, Button.Physical)) f.buffer.physical = BUFFER_FRAMES;
  if (has(pressed, Button.Dash)) f.buffer.dash = BUFFER_FRAMES;
}

// ── 2. Actions ────────────────────────────────────────────────────────────────────────────────────────────────────

function setAction(f: Fighter, action: ActionKind, length = 0) {
  f.action = action;
  f.actionFrame = 1;
  f.actionLength = length;
}

const FREE_ACTIONS: readonly ActionKind[] = ['idle', 'walkForward', 'walkBack'];

function think(f: Fighter, opponentX: number) {
  // Advance the current action; when it ends, the fighter is free again on this same frame.
  f.actionFrame++;
  if (f.actionLength > 0 && f.actionFrame > f.actionLength) {
    if (f.action === 'prejump') launch(f);
    else setAction(f, 'idle');
  }

  f.actionable = FREE_ACTIONS.includes(f.action);
  if (f.actionable) {
    if (opponentX !== f.x) f.facing = opponentX > f.x ? 1 : -1;
    const forward = f.facing === 1 ? Button.Right : Button.Left;
    const back = f.facing === 1 ? Button.Left : Button.Right;

    if (f.buffer.physical > 0) {
      f.buffer.physical = 0;
      f.connected = false;
      setAction(f, 'attack', attackLength(PHYSICAL));
    } else if (f.buffer.dash > 0) {
      f.buffer.dash = 0;
      // Dash + back is a back dash; dash alone (or + forward) dashes forward.
      if (has(f.held, back)) setAction(f, 'backdash', dashLength(BACKDASH));
      else setAction(f, 'dash', dashLength(DASH));
    } else if (has(f.held, Button.Up)) {
      setAction(f, 'prejump', JUMP.prejump);
    } else if (has(f.held, forward)) {
      if (f.action !== 'walkForward') setAction(f, 'walkForward');
    } else if (has(f.held, back)) {
      if (f.action !== 'walkBack') setAction(f, 'walkBack');
    } else if (f.action !== 'idle') {
      setAction(f, 'idle');
    }
  } else if (f.action === 'jump' && f.buffer.physical > 0 && !f.airAttackUsed) {
    f.buffer.physical = 0;
    f.connected = false;
    f.airAttackUsed = true;
    setAction(f, 'airAttack');
  }

  if (f.action === 'prejump') f.jumpDirection = heldDirection(f);
  if (f.buffer.physical > 0) f.buffer.physical--;
  if (f.buffer.dash > 0) f.buffer.dash--;
}

/** Leaves the floor, in the direction held on the last grounded frame. */
function launch(f: Fighter) {
  if (f.jumpDirection === 1) f.vx = JUMP.forwardSpeed * f.facing;
  else if (f.jumpDirection === -1) f.vx = -JUMP.backSpeed * f.facing;
  else f.vx = 0;
  f.vy = JUMP.launchSpeed;
  f.airAttackUsed = false;
  setAction(f, 'jump');
}

function heldDirection(f: Fighter): -1 | 0 | 1 {
  const forward = f.facing === 1 ? Button.Right : Button.Left;
  const back = f.facing === 1 ? Button.Left : Button.Right;
  return has(f.held, forward) ? 1 : has(f.held, back) ? -1 : 0;
}

// ── 3. Movement ───────────────────────────────────────────────────────────────────────────────────────────────────

function dashSpeed(frame: number, dash: typeof DASH) {
  return frame > dash.startup && frame <= dash.startup + dash.moving ? dash.speed : 0;
}

/** Steers a jump towards the held direction's speed (no direction held: keeps the current speed). */
function steer(f: Fighter) {
  let target: number;
  if (has(f.held, Button.Right)) target = f.facing === 1 ? JUMP.forwardSpeed : JUMP.backSpeed;
  else if (has(f.held, Button.Left)) target = -(f.facing === -1 ? JUMP.forwardSpeed : JUMP.backSpeed);
  else return;
  if (f.vx < target) f.vx = Math.min(target, f.vx + AIR_CONTROL.accel);
  else f.vx = Math.max(target, f.vx - AIR_CONTROL.accel);
}

function move(f: Fighter) {
  const airborne = f.y > 0 || f.vy > 0;
  let slide = false;

  // Player-controlled jumps can be steered; being hit or knocked out can't.
  if (airborne && (f.action === 'jump' || f.action === 'airAttack')) steer(f);

  if (!airborne) {
    switch (f.action) {
      case 'walkForward':
        f.vx = WALK.forward * f.facing;
        break;
      case 'walkBack':
        f.vx = -WALK.back * f.facing;
        break;
      case 'dash':
        f.vx = dashSpeed(f.actionFrame, DASH) * f.facing;
        break;
      case 'backdash':
        f.vx = -dashSpeed(f.actionFrame, BACKDASH) * f.facing;
        break;
      case 'attack': {
        const lunge = PHYSICAL.lunge;
        f.vx = lunge && f.actionFrame <= lunge.until ? lunge.speed * f.facing : 0;
        break;
      }
      case 'hitstun':
      case 'ko':
        slide = true; // keep the knockback speed, slowing down below
        break;
      default:
        f.vx = 0;
    }
  }

  f.x += f.vx;
  if (slide) f.vx = Math.trunc((f.vx * 7) / 8);

  if (airborne) {
    f.y += f.vy;
    f.vy -= JUMP.gravity;
    if (f.y <= 0) land(f);
  }
  f.x = clampToStage(f.x);
}

function land(f: Fighter) {
  f.y = 0;
  f.vy = 0;
  f.vx = 0;
  if (f.action === 'airHitstun') setAction(f, 'land', AIR_HIT.knockdown);
  else if (f.action !== 'ko') setAction(f, 'land', JUMP.landing);
}

const clampToStage = (x: number) => Math.min(STAGE_WIDTH - BODY_HALF_WIDTH, Math.max(BODY_HALF_WIDTH, x));

// ── 4. Push boxes ─────────────────────────────────────────────────────────────────────────────────────────────────

function separate(a: Fighter, b: Fighter) {
  if (a.action === 'ko' || b.action === 'ko') return;
  const verticalOverlap = a.y < b.y + BODY_HEIGHT && b.y < a.y + BODY_HEIGHT;
  const minDistance = BODY_HALF_WIDTH * 2;
  const overlap = minDistance - Math.abs(a.x - b.x);
  if (!verticalOverlap || overlap <= 0) return;

  const aIsLeft = a.x < b.x || (a.x === b.x && a.facing === 1);
  const [left, right] = aIsLeft ? [a, b] : [b, a];
  const half = Math.floor(overlap / 2);
  left.x = clampToStage(left.x - half);
  right.x = clampToStage(right.x + (overlap - half));
  // Against a wall, the other fighter takes the whole push.
  if (right.x - left.x < minDistance) {
    if (left.x === BODY_HALF_WIDTH) right.x = left.x + minDistance;
    else left.x = right.x - minDistance;
  }
}

// ── 5. Hits ───────────────────────────────────────────────────────────────────────────────────────────────────────

function resolveHits(state: FightState, events: FightEvent[]) {
  const [a, b] = state.fighters;
  const landed = ([[a, b], [b, a]] as const).filter(([attacker, defender]) => {
    if (attacker.connected || isInvincible(defender)) return false;
    const hitbox = activeHitbox(attacker);
    return hitbox !== null && overlaps(hitbox, bodyBox(defender));
  });

  for (const [attacker, defender] of landed) {
    const attack = currentAttack(attacker) ?? PHYSICAL;
    // Pushed away from the attacker (by position, not facing: a jump can cross over).
    const away = defender.x === attacker.x ? attacker.facing : Math.sign(defender.x - attacker.x);
    const air = defender.y > 0;
    attacker.connected = true;
    defender.hp = Math.max(0, defender.hp - attack.damage);
    defender.buffer.physical = 0;
    state.hitstop = HITSTOP;
    events.push({ type: 'hit', attacker: attacker.id, defender: defender.id, damage: attack.damage, air });

    if (defender.hp === 0) {
      setAction(defender, 'ko');
      defender.vx = away * KO_POP.push;
      defender.vy = KO_POP.launch;
      events.push({ type: 'ko', loser: defender.id });
    } else if (air) {
      setAction(defender, 'airHitstun');
      defender.vx = away * AIR_HIT.push;
      defender.vy = AIR_HIT.launch;
    } else {
      setAction(defender, 'hitstun', attack.hitstun);
      defender.vx = away * attack.knockback;
    }
    // Hitstun starts on the next frame.
    defender.actionFrame = 0;
    defender.actionable = false;
  }

  const [aOut, bOut] = [a.hp === 0, b.hp === 0];
  if (state.winner === null && (aOut || bOut)) state.winner = aOut && bOut ? 'draw' : aOut ? 1 : 0;
}
