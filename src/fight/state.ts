// The fight's whole state: plain data (no classes, no functions), so it can be copied, compared, saved and replayed.

import { MAX_HP, START_X } from './constants';
import type { InputMask } from './input';

export type ActionKind =
  | 'idle'
  | 'walkForward'
  | 'walkBack'
  | 'prejump'
  | 'jump'
  | 'land'
  | 'dash'
  | 'backdash'
  | 'attack'
  | 'airAttack'
  | 'hitstun'
  | 'airHitstun'
  | 'ko';

export type FighterId = 0 | 1;

export interface Fighter {
  id: FighterId;
  /** Sub-pixels (see constants.ts). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  action: ActionKind;
  /** 1 on the frame the action started. */
  actionFrame: number;
  /** How many frames the action lasts; 0 = until something else ends it (landing, for example). */
  actionLength: number;
  /** Whether the fighter could act on the last simulated frame (standing, walking or just recovered). */
  actionable: boolean;
  /** The current attack already hit (an attack hits once). */
  connected: boolean;
  airAttackUsed: boolean;
  /** Direction of the coming jump, read on each grounded frame of the prejump: 1 forward, -1 back, 0 straight up. */
  jumpDirection: -1 | 0 | 1;
  /** The input held on the last frame, to tell new presses from held buttons. */
  held: InputMask;
  /** Frames a press is still remembered for; 0 = nothing buffered. */
  buffer: { physical: number; dash: number };
}

export type Winner = FighterId | 'draw' | null;

export interface FightState {
  /** Simulated frames since the fight started. */
  frame: number;
  /** Frames left of the freeze after a hit. */
  hitstop: number;
  fighters: [Fighter, Fighter];
  winner: Winner;
}

export type FightEvent =
  | { type: 'hit'; attacker: FighterId; defender: FighterId; damage: number; air: boolean }
  | { type: 'ko'; loser: FighterId };

export interface FightOptions {
  x?: readonly [number, number];
  hp?: readonly [number, number];
}

function createFighter(id: FighterId, x: number, hp: number): Fighter {
  return {
    id,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing: id === 0 ? 1 : -1,
    hp,
    maxHp: MAX_HP,
    action: 'idle',
    actionFrame: 1,
    actionLength: 0,
    actionable: true,
    connected: false,
    airAttackUsed: false,
    jumpDirection: 0,
    held: 0,
    buffer: { physical: 0, dash: 0 },
  };
}

export function createFight(options: FightOptions = {}): FightState {
  const x = options.x ?? START_X;
  const hp = options.hp ?? [MAX_HP, MAX_HP];
  return {
    frame: 0,
    hitstop: 0,
    fighters: [createFighter(0, x[0], hp[0]), createFighter(1, x[1], hp[1])],
    winner: null,
  };
}
