// One frame of the fight: step(state, inputs) → new state + events. Pure: same state + same inputs = same result.
//
// Order of a frame:
//   1. Read inputs (new presses go into the buffer). During hitstop only this happens: presses are kept.
//   2. Each fighter advances its action and, if it can act, picks a new one (both decide from the same positions).
//   3. Movement and gravity.
//   4. Push boxes keep the fighters apart, walls keep them in the arena.
//   5. Projectiles: new ones appear, all move, opposite ones cancel out.
//   6. Hits: everything that connects on this frame is found first, then applied (two hits on one frame trade).
//   7. Round timer.
// A legendary boss (fight/boss.ts) also starts its attacks before 2, and advances them between 4 and 5; what they
// connect with is applied in 6 with everything else.

import { bossAttackInfo, BOSS_ATTACK, scheduleBoss, updateBoss, type BossAttackId, type BossHit } from './boss';
import { activeHitbox, bodyBox, currentMove, isGuarding, isInvincible, moveOf, overlaps, passesThrough, projectileBox } from './boxes';
import { BODY_HALF_WIDTH, BODY_HEIGHT, BUFFER_FRAMES, CHIP_DIVISOR, ELEMENTAL_COST, PP_MAX, STAGE_WIDTH } from './constants';
import { computeDamage, scaledDamage } from './damage';
import {
  AIR_CONTROL,
  AIR_HIT,
  AIR_PHYSICAL_POWER,
  BACKDASH,
  DASH,
  GUARD,
  JUMP,
  KO_POP,
  PHYSICAL,
  PHYSICAL_POWER,
  WALK,
  dashLength,
  moveLength,
  type HitData,
  type SpecialSlot,
} from './frame-data';
import { Button, cleanDirections, has, type InputMask } from './input';
import { motionDone, pushDirections } from './motion';
import type { ActionKind, AttackInfo, FightEvent, FightState, Fighter, HitSource } from './state';

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
  for (const f of state.fighters) if (f.boss) scheduleBoss(state, f, events);
  // Both decide from the positions at the start of the frame, so player 1 has no advantage over player 2.
  const startX = [a.x, b.x];
  think(a, startX[1], events);
  think(b, startX[0], events);
  move(a);
  move(b);
  separate(a, b);
  const bossHits = state.fighters.flatMap(f => (f.boss ? updateBoss(state, f, events) : []));
  spawnProjectiles(state);
  moveProjectiles(state);
  resolveHits(state, events, bossHits);
  tickTimer(state, events);
  return { state, events };
}

// ── 1. Input ──────────────────────────────────────────────────────────────────────────────────────────────────────

function readInput(f: Fighter, mask: InputMask) {
  const pressed = mask & ~f.held;
  f.held = mask;
  f.directions = pushDirections(f.directions, mask);
  // The attack button right after back, down, forward is the free elemental special instead of a tackle. The motion
  // is checked when the button is pressed (with the facing of that moment), then buffered like any press.
  if (has(pressed, Button.Physical)) {
    if (motionDone(f.directions, f.facing)) f.buffer.motion = BUFFER_FRAMES;
    else f.buffer.physical = BUFFER_FRAMES;
  }
  if (has(pressed, Button.Special)) f.buffer.special = BUFFER_FRAMES;
  if (has(pressed, Button.Big)) f.buffer.big = BUFFER_FRAMES;
  if (has(pressed, Button.Dash)) f.buffer.dash = BUFFER_FRAMES;
}

// ── 2. Actions ────────────────────────────────────────────────────────────────────────────────────────────────────

function setAction(f: Fighter, action: ActionKind, length = 0) {
  refundUnfired(f);
  f.action = action;
  f.actionFrame = 1;
  f.actionLength = length;
}

/** Actions a fighter can leave at any moment. Guarding is one: you can attack straight out of a guard. */
const FREE_ACTIONS: readonly ActionKind[] = ['idle', 'walkForward', 'walkBack', 'guard'];

function think(f: Fighter, opponentX: number, events: FightEvent[]) {
  // Advance the current action; when it ends, the fighter is free again on this same frame.
  f.actionFrame++;
  if (f.actionLength > 0 && f.actionFrame > f.actionLength) {
    if (f.action === 'prejump') launch(f);
    else setAction(f, 'idle');
  }

  // A strike locks on the opponent's spot during its charge (where the opponent stands at the start of this frame).
  if (f.action === 'big') {
    const strike = currentMove(f)?.strike;
    if (strike && f.actionFrame === strike.lockAt) f.target = opponentX;
  }

  f.actionable = FREE_ACTIONS.includes(f.action);
  const inJump = f.action === 'jump' && !f.airAttackUsed;
  // A special pressed without enough PP does nothing (the press is used up).
  if (f.actionable || inJump) {
    if (f.buffer.special > 0 && f.pp < ELEMENTAL_COST) f.buffer.special = 0;
    if (f.buffer.big > 0 && (f.pp < PP_MAX || !f.actionable)) f.buffer.big = 0;
  }

  if (f.actionable) {
    f.combo = 0;
    if (opponentX !== f.x) f.facing = opponentX > f.x ? 1 : -1;
    const forward = f.facing === 1 ? Button.Right : Button.Left;
    const back = f.facing === 1 ? Button.Left : Button.Right;

    // The motion first: it is the harder input, so it is the one the player meant.
    if (f.buffer.motion > 0) {
      startSpecial(f, 'elemental', events, true);
    } else if (f.buffer.physical > 0) {
      f.buffer.physical = 0;
      f.contact = null;
      setAction(f, 'attack', moveLength(PHYSICAL));
    } else if (f.buffer.special > 0) {
      startSpecial(f, 'elemental', events);
    } else if (f.buffer.big > 0) {
      startSpecial(f, 'big', events);
    } else if (f.buffer.dash > 0) {
      f.buffer.dash = 0;
      // Dash + back is a back dash; dash alone (or + forward) dashes forward.
      if (has(f.held, back)) setAction(f, 'backdash', dashLength(BACKDASH));
      else setAction(f, 'dash', dashLength(DASH));
    } else if (has(f.held, Button.Guard)) {
      if (f.action !== 'guard') setAction(f, 'guard');
    } else if (f.action === 'guard') {
      setAction(f, 'guardEnd', GUARD.release);
    } else if (has(f.held, Button.Up)) {
      setAction(f, 'prejump', JUMP.prejump);
    } else if (has(f.held, forward)) {
      if (f.action !== 'walkForward') setAction(f, 'walkForward');
    } else if (has(f.held, back)) {
      if (f.action !== 'walkBack') setAction(f, 'walkBack');
    } else if (f.action !== 'idle') {
      setAction(f, 'idle');
    }
  } else if (inJump) {
    // In the air the motion works like the special button: it uses the jump's one air move.
    if (f.buffer.motion > 0) {
      f.airAttackUsed = true;
      startSpecial(f, 'elemental', events, true);
    } else if (f.buffer.physical > 0) {
      f.buffer.physical = 0;
      f.contact = null;
      f.airAttackUsed = true;
      setAction(f, 'airAttack');
    } else if (f.buffer.special > 0) {
      f.airAttackUsed = true;
      startSpecial(f, 'elemental', events);
    }
  }

  if (f.action === 'prejump') f.jumpDirection = heldDirection(f);
  for (const key of ['physical', 'special', 'big', 'dash', 'motion'] as const) {
    if (f.buffer[key] > 0) f.buffer[key]--;
  }
}

/**
 * PP is spent when the charge starts (the bar drops at once); if the special never comes out (a hit during the
 * charge cancels it), refundUnfired gives it back. `free`: the elemental special from the motion, which spends no PP
 * (and earns none when it lands).
 */
function startSpecial(f: Fighter, slot: SpecialSlot, events: FightEvent[], free = false) {
  const airborne = f.y > 0 || f.vy > 0;
  f.buffer[free ? 'motion' : slot === 'elemental' ? 'special' : 'big'] = 0;
  if (!free) f.pp -= slot === 'elemental' ? ELEMENTAL_COST : PP_MAX;
  f.freeSpecial = free;
  f.target = null;
  f.contact = null;
  // In the air it lasts until landing, like the air attack.
  setAction(f, slot, airborne ? 0 : moveLength(moveOf(slot, f.loadout)!));
  events.push({ type: 'special', fighter: f.id, slot });
}

/**
 * PP pays only for a special that comes out (decided after milestone 12: losing it to a hit during the charge felt
 * like a bug). Called whenever an action is replaced: a special still in its startup was cut short, so its PP returns.
 */
function refundUnfired(f: Fighter) {
  if ((f.action !== 'elemental' && f.action !== 'big') || f.freeSpecial) return;
  if (f.actionFrame > moveOf(f.action, f.loadout)!.startup) return;
  f.pp = Math.min(PP_MAX, f.pp + (f.action === 'elemental' ? ELEMENTAL_COST : PP_MAX));
}

/** A horizontal speed, adjusted by the Pokémon's speed (mobility %). Frame data never changes. */
const bySpeed = (f: Fighter, speed: number) => Math.round((speed * f.mobility) / 100);

/** Leaves the floor, in the direction held on the last grounded frame. */
function launch(f: Fighter) {
  if (f.jumpDirection === 1) f.vx = bySpeed(f, JUMP.forwardSpeed) * f.facing;
  else if (f.jumpDirection === -1) f.vx = -bySpeed(f, JUMP.backSpeed) * f.facing;
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
  if (has(f.held, Button.Right)) target = bySpeed(f, f.facing === 1 ? JUMP.forwardSpeed : JUMP.backSpeed);
  else if (has(f.held, Button.Left)) target = -bySpeed(f, f.facing === -1 ? JUMP.forwardSpeed : JUMP.backSpeed);
  else return;
  if (f.vx < target) f.vx = Math.min(target, f.vx + AIR_CONTROL.accel);
  else f.vx = Math.max(target, f.vx - AIR_CONTROL.accel);
}

function move(f: Fighter) {
  const airborne = f.y > 0 || f.vy > 0;
  let slide = false;

  // Player-controlled jumps can be steered; being hit, knocked out or doing a special can't.
  if (airborne && (f.action === 'jump' || f.action === 'airAttack')) steer(f);

  if (!airborne) {
    switch (f.action) {
      case 'walkForward':
        f.vx = bySpeed(f, WALK.forward) * f.facing;
        break;
      case 'walkBack':
        f.vx = -bySpeed(f, WALK.back) * f.facing;
        break;
      case 'dash':
        f.vx = bySpeed(f, dashSpeed(f.actionFrame, DASH)) * f.facing;
        break;
      case 'backdash':
        f.vx = -bySpeed(f, dashSpeed(f.actionFrame, BACKDASH)) * f.facing;
        break;
      case 'attack': {
        const lunge = PHYSICAL.lunge;
        f.vx = lunge && f.actionFrame <= lunge.until ? lunge.speed * f.facing : 0;
        break;
      }
      case 'big': {
        const big = currentMove(f)!;
        // A guarded rush stops dead next to the defender (and can be punished); a rush that hits goes through.
        const rushing =
          big.rush && f.actionFrame > big.startup && f.actionFrame <= big.startup + big.active && f.contact !== 'block';
        f.vx = rushing ? big.rush!.speed * f.facing : 0;
        break;
      }
      case 'hitstun':
      case 'blockstun':
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

/**
 * Touching the floor ends any air action, except an air special still charging: it goes on from the ground and fires
 * there (it used to be lost with its PP, so a special pressed late in a jump seemed to vanish).
 */
function land(f: Fighter) {
  f.y = 0;
  f.vy = 0;
  f.vx = 0;
  const special = f.action === 'elemental' ? moveOf(f.action, f.loadout)! : null;
  if (special && f.actionFrame <= special.startup) f.actionLength = moveLength(special);
  else if (f.action === 'airHitstun') setAction(f, 'land', AIR_HIT.knockdown);
  else if (f.action !== 'ko') setAction(f, 'land', JUMP.landing);
}

const clampToStage = (x: number) => Math.min(STAGE_WIDTH - BODY_HALF_WIDTH, Math.max(BODY_HALF_WIDTH, x));

// ── 4. Push boxes ─────────────────────────────────────────────────────────────────────────────────────────────────

function separate(a: Fighter, b: Fighter) {
  if (passesThrough(a) || passesThrough(b)) return;
  // When a dash ends inside the opponent, whoever is past the other's center ends up on that side.
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

// ── 5. Projectiles ────────────────────────────────────────────────────────────────────────────────────────────────

function spawnProjectiles(state: FightState) {
  for (const f of state.fighters) {
    const move = currentMove(f);
    if (!move || f.actionFrame !== move.startup + 1) continue;
    const slot = f.action === 'big' ? 'big' : 'elemental';
    // Ids: unique within the fight (several per frame for a barrage or a quake's two waves).
    let id = (state.frame * 2 + f.id) * 8;
    const p = move.projectile;
    if (p) {
      for (const dir of p.bothWays ? [f.facing, -f.facing] : [f.facing]) {
        state.projectiles.push({
          id: id++,
          owner: f.id,
          slot,
          attack: specialAttack(f, slot),
          x: f.x + dir * p.spawnX,
          halfWidth: p.halfWidth,
          y1: f.y + p.y1,
          y2: f.y + p.y2,
          vx: dir * p.speed,
          ...(slot === 'big' ? { form: f.loadout.big.shape } : {}),
          hit: slot === 'elemental' ? earned(f, move.hit) : move.hit,
        });
      }
    }
    const b = move.barrage;
    if (b) {
      // Each one is thrown so it lands its distance ahead after `flight` frames (whole sub-pixels: it lands near it).
      const attack = specialAttack(f, slot);
      for (const distance of b.distances) {
        state.projectiles.push({
          id: id++,
          owner: f.id,
          slot,
          attack: { ...attack, power: Math.max(1, Math.round(attack.power * b.share)) },
          x: f.x,
          halfWidth: b.halfWidth,
          y1: f.y + b.fromY,
          y2: f.y + b.fromY + b.height,
          vx: f.facing * Math.round(distance / b.flight),
          vy: Math.round((b.gravity * b.flight) / 2 - b.fromY / b.flight),
          gravity: b.gravity,
          form: f.loadout.big.shape,
          hit: b.hit,
        });
      }
    }
  }
}

/** The free elemental special (from the motion) earns no PP when it lands, so it can't be used to fill the bar. */
const earned = (f: Fighter, hit: HitData): HitData => (f.freeSpecial ? { ...hit, ppGain: 0 } : hit);

function specialAttack(f: Fighter, slot: 'elemental' | 'big'): AttackInfo {
  const { power, type, category } = f.loadout[slot];
  return { power, type, category };
}

/** What the fighter's current melee move does to HP (the tackle is typeless). */
function meleeAttack(f: Fighter): AttackInfo {
  if (f.action === 'elemental' || f.action === 'big') return specialAttack(f, f.action);
  return { power: f.action === 'airAttack' ? AIR_PHYSICAL_POWER : PHYSICAL_POWER, type: null, category: 'physical' };
}

function moveProjectiles(state: FightState) {
  for (const p of state.projectiles) {
    p.x += p.vx;
    if (p.vy !== undefined) {
      p.y1 += p.vy;
      p.y2 += p.vy;
      p.vy -= p.gravity ?? 0;
    }
  }
  // Gone once off the stage, or sunk into the floor (a barrage's rocks).
  const onStage = state.projectiles.filter(p => p.x + p.halfWidth > 0 && p.x - p.halfWidth < STAGE_WIDTH && p.y2 > 0);

  // Opposite projectiles that touch cancel out; a big one goes through a small one.
  const gone = new Set<number>();
  onStage.forEach((p, i) => {
    onStage.forEach((q, j) => {
      if (j <= i || p.owner === q.owner || gone.has(i) || gone.has(j)) return;
      if (!overlaps(projectileBox(p), projectileBox(q))) return;
      const pBig = p.slot === 'big';
      const qBig = q.slot === 'big';
      if (pBig === qBig) {
        gone.add(i);
        gone.add(j);
      } else {
        gone.add(pBig ? j : i);
      }
    });
  });
  state.projectiles = onStage.filter((_, i) => !gone.has(i));
}

// ── 6. Hits ───────────────────────────────────────────────────────────────────────────────────────────────────────

interface Connection {
  attacker: Fighter;
  defender: Fighter;
  hit: HitData;
  attack: AttackInfo;
  /** The direction the defender is pushed: away from the attacker (or along the projectile's flight). */
  away: number;
  /** A melee hit (tackle, beam, rush) rather than a projectile: it marks the attacker's move as hit or blocked. */
  melee: boolean;
  source: HitSource;
  /** A guard keeps 1/guardDivisor of the damage (default: specials' chip, CHIP_DIVISOR). */
  guardDivisor?: number;
  bossAttack?: BossAttackId;
}

function meleeSource(f: Fighter): HitSource {
  if (f.action === 'airAttack') return 'air';
  if (f.action === 'elemental' || f.action === 'big') return f.action;
  return 'tackle';
}

function resolveHits(state: FightState, events: FightEvent[], bossHits: readonly BossHit[]) {
  const [a, b] = state.fighters;
  const connections: Connection[] = [];

  for (const [attacker, defender] of [[a, b], [b, a]] as const) {
    if (attacker.contact || isInvincible(defender)) continue;
    const hitbox = activeHitbox(attacker);
    if (!hitbox || !overlaps(hitbox, bodyBox(defender))) continue;
    // Marked as a hit for now; applyHit changes it to 'block' if the defender guards.
    attacker.contact = 'hit';
    // By position, not facing: a jump or a rush can cross over.
    const away = defender.x === attacker.x ? attacker.facing : Math.sign(defender.x - attacker.x);
    const hit = currentMove(attacker)!.hit;
    connections.push({ attacker, defender, hit: attacker.action === 'elemental' ? earned(attacker, hit) : hit, attack: meleeAttack(attacker), away, melee: true, source: meleeSource(attacker) });
  }

  state.projectiles = state.projectiles.filter(p => {
    const defender = state.fighters[p.owner === 0 ? 1 : 0];
    if (isInvincible(defender) || !overlaps(projectileBox(p), bodyBox(defender))) return true;
    connections.push({ attacker: state.fighters[p.owner], defender, hit: p.hit, attack: p.attack, away: Math.sign(p.vx), melee: false, source: p.slot });
    return false;
  });

  for (const { boss, attack, away } of bossHits) {
    const [attacker, defender] = boss === 0 ? [a, b] : [b, a];
    const data = BOSS_ATTACK[attack];
    connections.push({
      attacker,
      defender,
      hit: data.hit,
      attack: bossAttackInfo(attacker, defender, attack),
      away,
      melee: false,
      source: 'boss',
      guardDivisor: data.guard,
      bossAttack: attack,
    });
  }

  for (const connection of connections) {
    if (connection.defender.hp > 0) applyHit(state, connection, events);
  }

  const [aOut, bOut] = [a.hp === 0, b.hp === 0];
  if (state.winner === null && (aOut || bOut)) state.winner = aOut && bOut ? 'draw' : aOut ? 1 : 0;
}

/** Blocked hits freeze for less time than clean hits. */
const blockHitstop = (hit: HitData) => Math.max(4, Math.floor(hit.hitstop / 2));

function applyHit(state: FightState, connection: Connection, events: FightEvent[]) {
  const { attacker, defender, hit, attack, away, melee, source } = connection;
  // Only boss hits carry the attack's name (other events keep their exact shape).
  const named = connection.bossAttack ? { bossAttack: connection.bossAttack } : {};
  const { damage: fullDamage, effectiveness } = computeDamage(attacker, defender, attack);
  if (isGuarding(defender)) {
    if (melee) attacker.contact = 'block';
    const chip = hit.chip ? Math.floor(fullDamage / (connection.guardDivisor ?? CHIP_DIVISOR)) : 0;
    defender.hp = Math.max(0, defender.hp - chip);
    defender.combo = 0;
    state.hitstop = Math.max(state.hitstop, blockHitstop(hit));
    events.push({ type: 'block', attacker: attacker.id, defender: defender.id, chip, source, ...named });
    if (defender.hp === 0) return knockOut(defender, away, events);
    setAction(defender, 'blockstun', hit.blockstun);
    defender.actionFrame = 0; // blockstun starts on the next frame
    defender.actionable = false;
    defender.vx = away * hit.knockback;
    return;
  }

  const air = defender.y > 0;
  // A type that can't touch the defender (Normal → Ghost, Electric → Ground…): it passes harmlessly.
  if (effectiveness === 0) {
    events.push({ type: 'hit', attacker: attacker.id, defender: defender.id, damage: 0, effectiveness, air, big: hit.big, combo: defender.combo, source, ...named });
    return;
  }
  const damage = Math.max(1, scaledDamage(fullDamage, defender.combo));
  defender.combo++;
  defender.hp = Math.max(0, defender.hp - damage);
  defender.buffer = { physical: 0, special: 0, big: 0, dash: 0, motion: 0 };
  attacker.pp = Math.min(PP_MAX, attacker.pp + hit.ppGain);
  state.hitstop = Math.max(state.hitstop, hit.hitstop);
  events.push({ type: 'hit', attacker: attacker.id, defender: defender.id, damage, effectiveness, air, big: hit.big, combo: defender.combo, source, ...named });

  if (defender.hp === 0) return knockOut(defender, away, events);
  // Super armor: a boss locked in one of its attacks takes the damage but isn't stunned or pushed (fight/boss.ts).
  if (defender.action === 'bossAttack') return;
  if (air || hit.launch) {
    setAction(defender, 'airHitstun');
    defender.vx = away * (hit.launch?.push ?? AIR_HIT.push);
    defender.vy = hit.launch?.vy ?? AIR_HIT.launch;
  } else {
    setAction(defender, 'hitstun', hit.hitstun);
    defender.vx = away * hit.knockback;
  }
  // Hitstun starts on the next frame.
  defender.actionFrame = 0;
  defender.actionable = false;
}

function knockOut(f: Fighter, away: number, events: FightEvent[]) {
  setAction(f, 'ko');
  f.actionFrame = 0;
  f.actionable = false;
  f.vx = away * KO_POP.push;
  f.vy = KO_POP.launch;
  events.push({ type: 'ko', loser: f.id });
}

// ── 7. Timer ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** When time runs out, the Pokémon with the lower HP % faints (both, if equal). */
function tickTimer(state: FightState, events: FightEvent[]) {
  if (state.winner !== null) return;
  state.timer--;
  if (state.timer > 0) return;
  const [a, b] = state.fighters;
  // Compare a.hp / a.maxHp with b.hp / b.maxHp without fractions.
  const difference = a.hp * b.maxHp - b.hp * a.maxHp;
  const losers = difference < 0 ? [a] : difference > 0 ? [b] : [a, b];
  state.timeOver = true;
  events.push({ type: 'timeout' });
  for (const loser of losers) {
    loser.hp = 0;
    knockOut(loser, loser.id === 0 ? -1 : 1, events);
  }
  state.winner = losers.length === 2 ? 'draw' : losers[0].id === 0 ? 1 : 0;
}
