// Helpers for the fight tests: run scripted inputs frame by frame and collect what happened.

import { bossAttackInfo, type BossAttackId } from './boss';
import { MAX_HP, PP_PER_HP_PERCENT, px } from './constants';
import { bigDamage, computeDamage } from './damage';
import { PHYSICAL_POWER } from './frame-data';
import type { InputMask } from './input';
import { createFight, type AttackInfo, type FightEvent, type FightOptions, type FightState, type FighterId } from './state';
import { step } from './step';

/** Player input for a frame: a fixed mask, or a function of the frame number (1 = the first simulated frame). */
export type Script = InputMask | ((frame: number) => InputMask);

const inputAt = (script: Script, frame: number) => (typeof script === 'number' ? script : script(frame));

export interface Run {
  /** The state after each frame: frames[0] is after frame 1. */
  frames: FightState[];
  events: (FightEvent & { frame: number })[];
  final: FightState;
}

export function run(frameCount: number, p1: Script = 0, p2: Script = 0, start: FightState = createFight()): Run {
  let state = start;
  const frames: FightState[] = [];
  const events: Run['events'] = [];
  for (let i = 0; i < frameCount; i++) {
    const frame = state.frame + 1;
    const result = step(state, [inputAt(p1, frame), inputAt(p2, frame)]);
    state = result.state;
    frames.push(state);
    events.push(...result.events.map(e => ({ ...e, frame })));
  }
  return { frames, events, final: state };
}

/** The state after a given frame (1-based). */
export const at = (r: Run, frame: number) => r.frames[frame - 1];

/** Presses (holds) a button only on these frames. */
export const on = (mask: InputMask, ...frames: number[]) => (frame: number) => (frames.includes(frame) ? mask : 0);

/** Holds a button from one frame to another (inclusive). */
export const between = (mask: InputMask, from: number, to: number) => (frame: number) =>
  frame >= from && frame <= to ? mask : 0;

/** Fighters this many pixels apart (centers), in the middle of the arena. */
export function fightAt(distance: number, options: Omit<FightOptions, 'x'> = {}): FightState {
  const center = 240;
  return createFight({ ...options, x: [px(center - distance / 2), px(center + distance / 2)] });
}

/** The damage an attack from this fighter does to the other one, in this state (no combo scaling). */
export function damageOf(state: FightState, attacker: FighterId, attack: AttackInfo): number {
  return computeDamage(state.fighters[attacker], state.fighters[attacker === 0 ? 1 : 0], attack).damage;
}

/** The PP a fighter gets for taking this much damage (fight/constants.ts PP_PER_HP_PERCENT). */
export const hitPp = (damage: number, maxHp = MAX_HP) => Math.floor((damage * 100 * PP_PER_HP_PERCENT) / maxHp);

/** A tackle between the two default test fighters (Lv. 50, all stats 100). */
export const TACKLE_DAMAGE = damageOf(createFight(), 0, { power: PHYSICAL_POWER, type: null, category: 'physical' });

/** The full damage of a boss attack (no guard, no combo scaling), in this state. */
export function bossDamage(state: FightState, attack: BossAttackId, boss: FighterId = 1): number {
  const [attacker, defender] = [state.fighters[boss], state.fighters[boss === 0 ? 1 : 0]];
  return computeDamage(attacker, defender, bossAttackInfo(attacker, defender, attack)).damage;
}

/** A big special's damage (fight/damage.ts bigDamage) from this fighter on the other, in this state. */
export function bigHitDamage(state: FightState, attacker: FighterId = 0, part?: number): number {
  const [a, d] = [state.fighters[attacker], state.fighters[attacker === 0 ? 1 : 0]];
  const { power, type, category } = a.loadout.big;
  return bigDamage(a, d, { power, type, category, part }, d.maxHp).damage;
}

/** The default test fighter's specials (from DEFAULT_LOADOUT) on the other default fighter. */
export function specialDamage(slot: 'elemental' | 'big', state: FightState = createFight(), attacker: FighterId = 0): number {
  const { power, type, category } = state.fighters[attacker].loadout[slot];
  return damageOf(state, attacker, { power, type, category });
}
