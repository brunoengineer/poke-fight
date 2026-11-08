// The state of one fight between two Pokémon: plain data (no classes, no functions), so it can be copied, compared,
// saved and replayed. A battle (6 vs 6) is a series of these, see battle.ts.

import { MAX_HP, PP_START, ROUND_FRAMES, START_X } from './constants';
import type { BigShape, ElementalShape, HitData, SpecialSlot } from './frame-data';
import type { InputMask } from './input';

export type ActionKind =
  | 'idle'
  | 'walkForward'
  | 'walkBack'
  | 'guard'
  | 'guardEnd'
  | 'prejump'
  | 'jump'
  | 'land'
  | 'dash'
  | 'backdash'
  | 'attack'
  | 'airAttack'
  | 'elemental'
  | 'big'
  | 'hitstun'
  | 'airHitstun'
  | 'blockstun'
  | 'ko';

export type FighterId = 0 | 1;

/** A Pokémon's two specials. Names and types are for display until real moves arrive (milestone 4). */
export interface Loadout {
  elemental: { name: string; type: string; shape: ElementalShape };
  big: { name: string; type: string; shape: BigShape };
}

export const DEFAULT_LOADOUT: Loadout = {
  elemental: { name: 'Ember', type: 'fire', shape: 'projectile' },
  big: { name: 'Fire Blast', type: 'fire', shape: 'projectile' },
};

export interface Fighter {
  id: FighterId;
  name: string;
  type: string;
  loadout: Loadout;
  /** Sub-pixels (see constants.ts). */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 = facing right, -1 = facing left. */
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  pp: number;
  action: ActionKind;
  /** 1 on the frame the action started. */
  actionFrame: number;
  /** How many frames the action lasts; 0 = until something else ends it (landing, for example). */
  actionLength: number;
  /** Whether the fighter could act on the last simulated frame (standing, walking, guarding or just recovered). */
  actionable: boolean;
  /** What the current attack already did (an attack connects once): hit, blocked, or nothing yet. */
  contact: 'hit' | 'block' | null;
  /** One air move (attack or elemental special) per jump. */
  airAttackUsed: boolean;
  /** Direction of the coming jump, read on each grounded frame of the prejump: 1 forward, -1 back, 0 straight up. */
  jumpDirection: -1 | 0 | 1;
  /** Hits taken in the current combo (resets when the fighter can act again). Scales damage down. */
  combo: number;
  /** The input held on the last frame, to tell new presses from held buttons. */
  held: InputMask;
  /** Frames a press is still remembered for; 0 = nothing buffered. */
  buffer: { physical: number; special: number; big: number; dash: number };
}

export interface Projectile {
  /** Unique within a fight (the CPU decides once per projectile). */
  id: number;
  owner: FighterId;
  slot: SpecialSlot;
  type: string;
  x: number;
  halfWidth: number;
  y1: number;
  y2: number;
  vx: number;
  hit: HitData;
}

export type Winner = FighterId | 'draw' | null;

export interface FightState {
  /** Simulated frames since the fight started. */
  frame: number;
  /** Frames left of the freeze after a hit. */
  hitstop: number;
  /** Frames left on the round timer. */
  timer: number;
  fighters: [Fighter, Fighter];
  projectiles: Projectile[];
  winner: Winner;
  /** The round ended on the timer, not on a hit. */
  timeOver: boolean;
}

export type FightEvent =
  | { type: 'hit'; attacker: FighterId; defender: FighterId; damage: number; air: boolean; big: boolean; combo: number }
  | { type: 'block'; attacker: FighterId; defender: FighterId; chip: number }
  | { type: 'special'; fighter: FighterId; slot: SpecialSlot }
  | { type: 'ko'; loser: FighterId }
  | { type: 'timeout' };

/** Who is fighting: everything that comes from the Pokémon (the rest is the fight's own state). */
export interface FighterSetup {
  name: string;
  type: string;
  maxHp: number;
  hp: number;
  pp: number;
  loadout: Loadout;
}

export interface FightOptions {
  x?: readonly [number, number];
  /** Shortcuts for tests. */
  hp?: readonly [number, number];
  pp?: readonly [number, number];
  fighters?: readonly [Partial<FighterSetup>, Partial<FighterSetup>];
}

function createFighter(id: FighterId, x: number, setup: FighterSetup): Fighter {
  return {
    id,
    name: setup.name,
    type: setup.type,
    loadout: structuredClone(setup.loadout),
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing: id === 0 ? 1 : -1,
    hp: setup.hp,
    maxHp: setup.maxHp,
    pp: setup.pp,
    action: 'idle',
    actionFrame: 1,
    actionLength: 0,
    actionable: true,
    contact: null,
    airAttackUsed: false,
    jumpDirection: 0,
    combo: 0,
    held: 0,
    buffer: { physical: 0, special: 0, big: 0, dash: 0 },
  };
}

const DEFAULT_SETUP: FighterSetup = {
  name: 'Fighter',
  type: 'normal',
  maxHp: MAX_HP,
  hp: MAX_HP,
  pp: PP_START,
  loadout: DEFAULT_LOADOUT,
};

export function createFight(options: FightOptions = {}): FightState {
  const x = options.x ?? START_X;
  const setup = (i: FighterId): FighterSetup => {
    const given = options.fighters?.[i] ?? {};
    const maxHp = given.maxHp ?? DEFAULT_SETUP.maxHp;
    return {
      ...DEFAULT_SETUP,
      ...given,
      maxHp,
      hp: options.hp?.[i] ?? given.hp ?? maxHp,
      pp: options.pp?.[i] ?? given.pp ?? PP_START,
    };
  };
  return {
    frame: 0,
    hitstop: 0,
    timer: ROUND_FRAMES,
    fighters: [createFighter(0, x[0], setup(0)), createFighter(1, x[1], setup(1))],
    projectiles: [],
    winner: null,
    timeOver: false,
  };
}
