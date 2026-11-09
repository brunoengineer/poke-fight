// The state of one fight between two Pokémon: plain data (no classes, no functions), so it can be copied, compared,
// saved and replayed. A battle (6 vs 6) is a series of these, see battle.ts.

import { createBossState, type BossAttackId, type BossPhase, type BossSetup, type BossState } from './boss';
import { MAX_HP, PP_START, ROUND_FRAMES, START_X } from './constants';
export { BOSS_ATTACKS, type BossAttackId, type BossSetup } from './boss';
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
  | 'ko'
  /** A legendary boss doing one of its attacks (fight/boss.ts). */
  | 'bossAttack';

export type FighterId = 0 | 1;

/** What a hit does to HP: the move's power, type (null = typeless, like the tackle) and category. */
export interface AttackInfo {
  power: number;
  type: string | null;
  category: 'physical' | 'special';
}

/** A Pokémon's two specials, as the fight needs them (built from its moves by game/pokemon.ts). */
export interface Loadout {
  elemental: { name: string; type: string; power: number; category: 'physical' | 'special'; shape: ElementalShape };
  big: { name: string; type: string; power: number; category: 'physical' | 'special'; shape: BigShape };
}

export const DEFAULT_LOADOUT: Loadout = {
  elemental: { name: 'Ember', type: 'fire', power: 40, category: 'special', shape: 'projectile' },
  big: { name: 'Fire Blast', type: 'fire', power: 110, category: 'special', shape: 'projectile' },
};

/** Battle stats (HP is separate: maxHp, in fight units). */
export interface FightStats {
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface Fighter {
  id: FighterId;
  /** For the sprite; null for test fighters. */
  speciesId: number | null;
  name: string;
  types: string[];
  level: number;
  stats: FightStats;
  /** Walk, dash and jump speed in % (from base Speed: game/stats.ts). */
  mobility: number;
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
  /** Directions held on the last frames, newest first, for the back, down, forward motion (fight/motion.ts). */
  directions: InputMask[];
  /** Frames a press is still remembered for; 0 = nothing buffered. `motion`: the attack button right after the motion. */
  buffer: { physical: number; special: number; big: number; dash: number; motion: number };
  /** The current elemental special came from the motion: it cost no PP, and landing it earns none. */
  freeSpecial: boolean;
  /** A strike's spot (x, sub-pixels), locked during its charge (fight/frame-data.ts StrikeData); null otherwise. */
  target: number | null;
  /** Legendary bosses only (the key is absent on everyone else): the attack schedule and the attack in progress. */
  boss?: BossState;
}

export interface Projectile {
  /** Unique within a fight (the CPU decides once per projectile). */
  id: number;
  owner: FighterId;
  slot: SpecialSlot;
  attack: AttackInfo;
  x: number;
  halfWidth: number;
  y1: number;
  y2: number;
  vx: number;
  /** Thrown in an arc (a barrage): vertical speed and gravity, in sub-pixels per frame. */
  vy?: number;
  gravity?: number;
  /** A big special's form (how it is drawn: a quake wave, a surf wave, a tornado, a barrage's rock…). */
  form?: BigShape;
  hit: HitData;
}

export type Winner = FighterId | 'draw' | null;

/** The move behind a hit or a block. */
export type HitSource = 'tackle' | 'air' | 'elemental' | 'big' | 'boss';

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
  | {
      type: 'hit';
      attacker: FighterId;
      defender: FighterId;
      damage: number;
      /** Type multiplier: 0 (no effect), ¼, ½, 1, 2 or 4. */
      effectiveness: number;
      air: boolean;
      big: boolean;
      combo: number;
      /** What landed. */
      source: HitSource;
      /** Which legendary attack, when the source is 'boss'. */
      bossAttack?: BossAttackId;
    }
  | { type: 'block'; attacker: FighterId; defender: FighterId; chip: number; source: HitSource; bossAttack?: BossAttackId }
  | { type: 'special'; fighter: FighterId; slot: SpecialSlot }
  | { type: 'ko'; loser: FighterId }
  | { type: 'timeout' }
  /** A boss attack's telegraph starts, its active part starts, or it is over (sounds and effects follow these). */
  | { type: 'bossAttack'; fighter: FighterId; attack: BossAttackId; phase: BossPhase }
  /** Part of a boss attack hits the ground: a meteor, a slam, the vortex's burst (x in sub-pixels). */
  | { type: 'bossImpact'; fighter: FighterId; attack: BossAttackId; x: number }
  /** The boss fell below 30% HP: its attacks come more often. */
  | { type: 'bossEnraged'; fighter: FighterId };

/** Who is fighting: everything that comes from the Pokémon (the rest is the fight's own state). */
export interface FighterSetup {
  speciesId: number | null;
  name: string;
  types: string[];
  level: number;
  stats: FightStats;
  mobility: number;
  /** In fight units (HP_UNITS per real HP). */
  maxHp: number;
  hp: number;
  pp: number;
  loadout: Loadout;
  /** A legendary boss: it performs these attacks on its own (fight/boss.ts). */
  boss?: BossSetup;
}

export interface FightOptions {
  x?: readonly [number, number];
  /** Shortcuts for tests. */
  hp?: readonly [number, number];
  pp?: readonly [number, number];
  fighters?: readonly [Partial<FighterSetup>, Partial<FighterSetup>];
  /** Frames on the round timer (default: 99 seconds). */
  timer?: number;
}

function createFighter(id: FighterId, x: number, setup: FighterSetup): Fighter {
  return {
    id,
    speciesId: setup.speciesId,
    name: setup.name,
    types: [...setup.types],
    level: setup.level,
    stats: { ...setup.stats },
    mobility: setup.mobility,
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
    directions: [],
    buffer: { physical: 0, special: 0, big: 0, dash: 0, motion: 0 },
    freeSpecial: false,
    target: null,
    // Only bosses get the key, so every other fighter stays exactly as it was.
    ...(setup.boss ? { boss: createBossState(setup.boss, bossSeed(setup)) } : {}),
  };
}

/** A boss's default schedule seed: from its species and HP, so each round (and each boss) plays a little differently. */
const bossSeed = (setup: FighterSetup) => (Math.imul(setup.speciesId ?? 0, 0x9e3779b1) ^ Math.imul(setup.hp + 1, 0x85ebca6b) ^ setup.maxHp) >>> 0;

/** The test fighter: Lv. 50, every stat 100, Normal type, average speed. */
const DEFAULT_SETUP: FighterSetup = {
  speciesId: null,
  name: 'Fighter',
  types: ['normal'],
  level: 50,
  stats: { atk: 100, def: 100, spa: 100, spd: 100, spe: 100 },
  mobility: 100,
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
    timer: options.timer ?? ROUND_FRAMES,
    fighters: [createFighter(0, x[0], setup(0)), createFighter(1, x[1], setup(1))],
    projectiles: [],
    winner: null,
    timeOver: false,
  };
}
