// The CPU opponent. Pure: cpuStep(cpu, state) → its input for the next frame + its new memory. Same seed and same
// fight = same decisions, so CPU fights replay and test like any other.
//
// Fair by construction:
//   - It only produces an input mask, like a keyboard: everything goes through the same rules as the player.
//   - It sees the opponent (and projectiles) `reaction` frames late; it knows its own state now, like a person.
//   - It decides once per threat (guard it, jump it, anti-air it, or miss it), with the profile's chances.
//
// Each frame:
//   1. Remember what it sees; look at the oldest memory (the delayed view).
//   2. Threats in the delayed view (projectile coming, beam/rush charging, attack up close, jump-in) → respond.
//   3. Opponent stuck in recovery nearby → punish.
//   4. Otherwise follow a short neutral plan (approach, retreat, wait, guard, special, jump in, dash…) chosen by
//      distance and style, and pick a new one when it runs out.

import { createRng } from '../../engine/rng';
import { moveOf, movePhase } from '../boxes';
import { ELEMENTAL_COST, PP_MAX, SUB } from '../constants';
import { JUMP } from '../frame-data';
import { Button, has, type InputMask } from '../input';
import type { ActionKind, FightState, Fighter, FighterId, Projectile } from '../state';
import type { AiProfile } from './profiles';

/** What the CPU sees of the opponent and the projectiles (the delayed part). */
export interface Observation {
  frame: number;
  opponent: Pick<Fighter, 'x' | 'y' | 'vx' | 'vy' | 'action' | 'actionFrame' | 'facing' | 'loadout'>;
  projectiles: Pick<Projectile, 'id' | 'owner' | 'x' | 'vx'>[];
}

export type PlanKind =
  | 'wait'
  | 'approach'
  | 'retreat'
  | 'guard'
  | 'jumpIn'
  | 'dash'
  | 'backdash'
  | 'tackle'
  | 'special'
  | 'big';

type Response = 'guard' | 'jump' | 'antiAir' | 'punish' | 'none';

export interface CpuState {
  me: FighterId;
  profile: AiProfile;
  rng: number;
  /** The last `reaction + 1` observations, oldest first. */
  seen: Observation[];
  plan: { kind: PlanKind; until: number };
  /** One decision per threat, by threat key. */
  responses: Record<string, Response>;
  /** The input it gave last frame (a button must be released before it can be pressed again). */
  last: InputMask;
  /** Its own action on the last frame (to notice the moment a block ends). */
  lastAction: ActionKind;
}

export function createCpu(me: FighterId, profile: AiProfile, seed: number): CpuState {
  return { me, profile, rng: seed >>> 0, seen: [], plan: { kind: 'wait', until: 0 }, responses: {}, last: 0, lastAction: 'idle' };
}

/** Forget the last round (a new Pokémon came in), keep the random sequence going. */
export const resetCpuMemory = (cpu: CpuState): CpuState => ({
  ...cpu,
  seen: [],
  plan: { kind: 'wait', until: 0 },
  responses: {},
  last: 0,
  lastAction: 'idle',
});

export function observe(state: FightState, me: FighterId): Observation {
  const o = state.fighters[me === 0 ? 1 : 0];
  return {
    frame: state.frame,
    opponent: { x: o.x, y: o.y, vx: o.vx, vy: o.vy, action: o.action, actionFrame: o.actionFrame, facing: o.facing, loadout: o.loadout },
    projectiles: state.projectiles.filter(p => p.owner !== me).map(p => ({ id: p.id, owner: p.owner, x: p.x, vx: p.vx })),
  };
}

// Distances in pixels.
const CLOSE = 70;
const FAR = 220;
const TACKLE_RANGE = 60;
const MELEE_THREAT = 100;
export const PROJECTILE_ALERT = 110;
/** Frames it guards after recovering from a hit up close. */
const RECOVER_GUARD = 12;
/** Jump over a projectile when it is about this close (its estimated position now): the jump clears it. */
const JUMP_OVER_AT = 60;

interface Wish {
  /** Directions relative to the CPU's facing, and guard. */
  hold?: { forward?: boolean; back?: boolean; up?: boolean; guard?: boolean };
  press?: 'physical' | 'special' | 'big' | 'dash';
}

export interface CpuStepResult {
  cpu: CpuState;
  input: InputMask;
}

export function cpuStep(previous: CpuState, state: FightState): CpuStepResult {
  const cpu: CpuState = { ...previous, seen: [...previous.seen, observe(state, previous.me)], responses: { ...previous.responses } };
  cpu.seen = cpu.seen.slice(-(cpu.profile.reaction + 1));
  const view = cpu.seen[0];
  const self = state.fighters[cpu.me];
  const rng = createRng(cpu.rng);
  const roll = (chance: number) => rng.next() < chance;

  const wish = state.winner === null ? decide(cpu, self, view, state.frame, roll, rng.int) : {};
  const input = toMask(wish, self, cpu.last);
  cpu.rng = rng.state;
  cpu.last = input;
  cpu.lastAction = self.action;
  return { cpu, input };
}

/** Decisions are kept this long (frames), then forgotten. */
const MEMORY = 240;

function decide(
  cpu: CpuState,
  self: Fighter,
  view: Observation,
  now: number,
  roll: (chance: number) => boolean,
  int: (max: number) => number,
): Wish {
  const { profile } = cpu;
  const opp = view.opponent;
  const distance = Math.abs(opp.x - self.x) / SUB;
  const towardsMe = (vx: number, x: number) => vx !== 0 && Math.sign(self.x - x) === Math.sign(vx);

  // One decision per threat. Keys are "kind:frame the threat started", so old ones can be forgotten.
  for (const key of Object.keys(cpu.responses)) {
    if (Number(key.split(':')[1]) < view.frame - MEMORY) delete cpu.responses[key];
  }
  const respond = (kind: string, startFrame: number, options: [Response, number][]): Response => {
    const key = `${kind}:${startFrame}`;
    // Roll the options in order; the first that succeeds is the answer.
    cpu.responses[key] ??= options.find(([, chance]) => roll(chance))?.[0] ?? 'none';
    return cpu.responses[key];
  };
  const actionStart = view.frame - opp.actionFrame;

  // Taking off: keep holding the direction (the jump's direction is read on the last grounded frame).
  if (self.action === 'prejump') return cpu.plan.kind === 'jumpIn' ? { hold: { up: true, forward: true } } : {};
  // In the air: an air attack on the way down, when close.
  if (self.action === 'jump') return distance < 50 && self.vy < 0 ? { press: 'physical' } : {};
  // Busy (attacking, in hitstun…): nothing to do but keep guarding if it was.
  if (!self.actionable) return self.action === 'blockstun' ? { hold: { guard: true } } : {};

  // Just blocked an attack: hit back right away. (The tackle is -1 on block, so this beats an opponent who keeps
  // pressing.) It is its own state, not the opponent's, so there is no reaction delay.
  if (cpu.lastAction === 'blockstun' && respond('counter', now, [['punish', profile.punish]]) === 'punish') {
    return { press: 'physical' };
  }

  // Just recovered from a hit up close: the next attack is probably already coming, so guard for a moment (then the
  // counter above can follow the block).
  if ((cpu.lastAction === 'hitstun' || cpu.lastAction === 'land') && distance < CLOSE) {
    if (respond('recover', now, [['guard', profile.guard]]) === 'guard') {
      cpu.plan = { kind: 'guard', until: now + RECOVER_GUARD };
      return { hold: { guard: true } };
    }
  }

  // ── 2. Threats ──
  let threat: Response = 'none';
  const oppMove = moveOf(opp.action, opp.loadout);
  const oppPhase = oppMove ? movePhase(oppMove, opp.actionFrame) : null;

  for (const p of view.projectiles) {
    const gap = Math.abs(p.x - self.x) / SUB;
    if (!towardsMe(p.vx, p.x) || gap > PROJECTILE_ALERT) continue;
    const r = respond('projectile', Math.floor(p.id / 2), [
      ['guard', profile.guard],
      ['jump', profile.jump],
    ]);
    // Jump when it is close. It sees late, so it estimates where the projectile is now from its speed (people do too).
    const gapNow = gap - (Math.abs(p.vx) / SUB) * profile.reaction;
    if (r === 'jump' && gapNow > JUMP_OVER_AT) continue;
    if (r !== 'none') threat = r;
  }

  // A beam or a rush being charged: nothing flies, so guard on the charge.
  const charging = (opp.action === 'elemental' || opp.action === 'big') && oppPhase === 'startup';
  const chargedShape = opp.action === 'big' ? opp.loadout.big.shape : opp.loadout.elemental.shape;
  if (charging && chargedShape !== 'projectile') {
    if (respond('charge', actionStart, [['guard', profile.guard]]) === 'guard') threat = 'guard';
  }

  // An attack up close (hard to see coming: lower chance than a projectile).
  if ((opp.action === 'attack' || opp.action === 'airAttack') && oppPhase !== 'recovery' && distance < MELEE_THREAT) {
    if (respond('melee', actionStart, [['guard', profile.guard * 0.6]]) === 'guard') threat = 'guard';
  }

  // A jump-in.
  const oppAirborne = opp.action === 'jump' || opp.action === 'airAttack';
  if (oppAirborne && distance < 140 && (towardsMe(opp.vx, opp.x) || distance < 60)) {
    const r = respond('jump', actionStart, [
      ['antiAir', profile.antiAir],
      ['guard', profile.guard],
    ]);
    // Anti-air: wait for it to come down into reach, then tackle.
    if (r === 'antiAir') return distance < 55 && opp.vy < 0 ? { press: 'physical' } : {};
    if (r === 'guard') threat = 'guard';
  }

  if (threat === 'guard') return { hold: { guard: true } };
  if (threat === 'jump') return { hold: { up: true } };

  // ── 3. Punish ──
  const stuck =
    (oppPhase === 'recovery' && !oppAirborne) || (opp.action === 'land' && opp.actionFrame === 1) || opp.action === 'guardEnd';
  if (stuck && distance < TACKLE_RANGE + 10 && respond('punish', actionStart, [['punish', profile.punish]]) === 'punish') {
    return { press: 'physical' };
  }

  // ── 4. Neutral plan ──
  if (now >= cpu.plan.until) {
    const [min, max] = profile.planFrames;
    const kind = choosePlan(profile, self, distance, roll);
    // A jump-in only needs the takeoff; after landing it thinks again.
    const length = kind === 'jumpIn' ? JUMP.prejump + 1 : min + int(max - min + 1);
    cpu.plan = { kind, until: now + length };
  }
  return follow(cpu, distance);
}

/** Plans that are a single press: once pressed, the CPU thinks again as soon as it can act. */
const ONE_SHOT: readonly PlanKind[] = ['tackle', 'special', 'big', 'dash', 'backdash'];

function choosePlan(profile: AiProfile, self: Fighter, distance: number, roll: (c: number) => boolean): PlanKind {
  const canSpecial = self.pp >= ELEMENTAL_COST;
  const bigShape = self.loadout.big.shape;
  if (self.pp >= PP_MAX && roll(profile.big)) {
    // A rush wants to be fairly close; projectiles and beams work from anywhere.
    if (bigShape !== 'rush' || distance < 160) return 'big';
  }
  const weights: [PlanKind, number][] =
    distance < CLOSE
      ? [
          ['tackle', profile.aggression],
          ['guard', profile.caution],
          ['backdash', profile.zoning * 0.5],
          ['dash', profile.aggression * 0.25],
          ['retreat', profile.zoning * 0.5],
          ['wait', 0.1],
        ]
      : distance < FAR
        ? [
            ['approach', profile.aggression],
            ['special', canSpecial ? profile.zoning : 0],
            ['jumpIn', profile.jump],
            ['retreat', profile.zoning * 0.4],
            ['wait', 0.3],
          ]
        : [
            ['special', canSpecial ? profile.zoning : 0],
            ['approach', profile.aggression],
            ['dash', profile.aggression * 0.3],
            ['wait', 0.2],
          ];
  // Weighted pick, using rolls only (so the random sequence stays simple to follow).
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  let left = total;
  for (const [kind, weight] of weights) {
    if (weight > 0 && roll(weight / left)) return kind;
    left -= weight;
  }
  return 'wait';
}

function follow(cpu: CpuState, distance: number): Wish {
  const { kind } = cpu.plan;
  if (ONE_SHOT.includes(kind)) cpu.plan = { kind: 'wait', until: 0 };
  switch (kind) {
    case 'approach':
      return distance > TACKLE_RANGE - 10 ? { hold: { forward: true } } : {};
    case 'retreat':
      return { hold: { back: true } };
    case 'guard':
      return { hold: { guard: true } };
    case 'tackle':
      return { press: 'physical' };
    case 'special':
      return { press: 'special' };
    case 'big':
      return { press: 'big' };
    case 'dash':
      return { press: 'dash' };
    case 'backdash':
      return { press: 'dash', hold: { back: true } };
    case 'jumpIn':
      return { hold: { up: true, forward: true } };
    case 'wait':
      return {};
  }
}

const PRESS_BUTTON = { physical: Button.Physical, special: Button.Special, big: Button.Big, dash: Button.Dash } as const;

function toMask(wish: Wish, self: Fighter, last: InputMask): InputMask {
  const forward = self.facing === 1 ? Button.Right : Button.Left;
  const back = self.facing === 1 ? Button.Left : Button.Right;
  let mask = 0;
  if (wish.hold?.forward) mask |= forward;
  if (wish.hold?.back) mask |= back;
  if (wish.hold?.up) mask |= Button.Up;
  if (wish.hold?.guard) mask |= Button.Guard;
  if (wish.press) {
    const button = PRESS_BUTTON[wish.press];
    // A press needs the button up on the frame before; if it was held, release now and press next frame.
    if (!has(last, button)) mask |= button;
  }
  return mask;
}

/** For the debug overlay. */
export const describeCpu = (cpu: CpuState) => `${cpu.profile.name}: ${cpu.plan.kind}`;
