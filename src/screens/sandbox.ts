// The fight sandbox (milestones 1–3): player 1's team against player 2's team, played by a training dummy or the
// CPU. No DOM here: main.ts feeds it the inputs and draws what view() returns, and the tests drive it directly.

import { pushHistory, type HistoryEntry } from '../engine/input/history';
import { createAdvantageTracker, trackAdvantage, type AdvantageTracker } from '../fight/advantage';
import { cpuStep, createCpu, describeCpu, resetCpuMemory, type CpuState } from '../fight/ai/cpu';
import { DIFFICULTIES, makeProfile, STYLES, type Difficulty, type Style } from '../fight/ai/profiles';
import { battleStep, createBattle, requestSwitch, type BattleEvent, type BattleState, type TeamMember } from '../fight/battle';
import { PP_MAX } from '../fight/constants';
import { DUMMY_MODES, dummyInput, type DummyMode } from '../fight/dummy';
import { cleanDirections, type InputMask } from '../fight/input';
import type { FightEvent, FighterId, FightState } from '../fight/state';
import type { MessageKey } from '../i18n';
import type { StageSpec } from '../render/stage';
import { ENTRANCE, type Entrance, type TrainerLook } from './entrance';
import { OPPONENT_TEAM, PLAYER_TEAM } from './sandbox-teams';

/** Frames of white flash after a big special lands. */
export const BIG_HIT_FLASH = 8;

/** How long a type effectiveness message stays on screen. */
export const EFFECT_FRAMES = 45;

export interface EffectMessage {
  text: 'effect.super' | 'effect.weak' | 'effect.none';
  /** The Pokémon that was hit (the message floats above it). */
  fighter: FighterId;
  frames: number;
}

/** The message for a hit's type effectiveness (a translation key), or null for a neutral hit. */
export function effectText(effectiveness: number): EffectMessage['text'] | null {
  if (effectiveness === 0) return 'effect.none';
  if (effectiveness > 1) return 'effect.super';
  if (effectiveness < 1) return 'effect.weak';
  return null;
}

/** Who plays player 2: a dummy behavior or a CPU difficulty. F2 cycles through them. */
export const OPPONENTS = [...DUMMY_MODES, ...DIFFICULTIES.map(d => `cpu-${d}` as const)] as const;
export type Opponent = DummyMode | `cpu-${Difficulty}`;

export const isOpponent = (value: string): value is Opponent => (OPPONENTS as readonly string[]).includes(value);

/** A message shown over the fight (the tutorial's instructions). */
export interface Banner {
  /** "Step 3 of 7", or null for a banner without steps. */
  step: { number: number; total: number } | null;
  key: MessageKey;
  params: Record<string, string | number>;
}

/**
 * Something that runs a fight instead of the dummy or the CPU options (the tutorial): it plays player 2 and may
 * adjust the round after each frame (tutorial safety). With a director, the training tools are off.
 */
export interface Director {
  input(round: FightState): InputMask;
  after(round: FightState, events: readonly FightEvent[]): void;
  banner(): Banner | null;
  /** For the tests and the debug overlay. */
  describe(): string;
}

export interface SandboxView {
  battle: BattleState;
  debug: boolean;
  opponent: Opponent;
  /** The CPU's style (F4), used when the opponent is a CPU. */
  style: Style;
  /** What the CPU is doing (for the debug overlay), or null for a dummy. */
  cpu: string | null;
  /** Training option (F3): both PP bars stay full. */
  infinitePp: boolean;
  history: readonly HistoryEntry[];
  advantage: AdvantageTracker['last'];
  /** Frames left of the big-hit flash. */
  flash: number;
  /** The last type effectiveness message, while it shows. */
  effect: EffectMessage | null;
  banner: Banner | null;
  /** Training tools (F1–F4, R) are available. */
  tools: boolean;
  /** Where the fight takes place (the background). */
  stage: StageSpec;
  /** The trainers at the edges of the arena (null: none, like a wild Pokémon's side). */
  trainers: [TrainerLook | null, TrainerLook | null];
  /** The trainers throwing their Poké Balls; the fight waits for it. */
  entrance: Entrance | null;
  /** Switching mid-round is part of this fight (not in the tutorial). */
  switching: boolean;
}

export interface Sandbox {
  /** Simulates one frame with player 1's input. Returns that frame's events. */
  tick(p1: InputMask): BattleEvent[];
  reset(): void;
  /** Player 1 asks to switch Pokémon mid-round (the battle's rules decide; never during the entrance). */
  trySwitch(): 'ok' | 'used' | 'alone' | 'busy';
  /** A new battle with this player team (after the party changed: XP, evolution, specials, healing). */
  setPlayerTeam(team: TeamMember[]): void;
  toggleDebug(): void;
  cycleOpponent(): void;
  cycleStyle(): void;
  toggleInfinitePp(): void;
  view(): SandboxView;
}

export interface SandboxOptions {
  player?: TeamMember[];
  opponentTeam?: TeamMember[];
  opponent?: Opponent;
  /** Seed for the CPU's decisions. */
  seed?: number;
  director?: Director;
  /** A message over the first seconds of the battle ("A wild Pidgey appeared!"). */
  intro?: Banner;
  /** The CPU's style (default: balanced). */
  style?: Style;
  /** Each round's timer, in frames (default: 99 seconds). */
  roundFrames?: number;
  /** Training tools (F1–F4, R). Default: on, unless a director runs the fight. Journey fights turn them off. */
  tools?: boolean;
  /** Play the trainers' entrance before each Pokémon comes in (the browser tests turn it off to stay frame-exact). */
  entrance?: boolean;
  stage?: StageSpec;
  trainers?: [TrainerLook | null, TrainerLook | null];
}

/** How long the intro message stays (frames). */
export const INTRO_FRAMES = 120;

const difficultyOf = (opponent: Opponent): Difficulty | null =>
  opponent.startsWith('cpu-') ? (opponent.slice(4) as Difficulty) : null;

export function createSandbox(options: SandboxOptions = {}): Sandbox {
  let player = options.player ?? PLAYER_TEAM;
  const opponentTeam = options.opponentTeam ?? OPPONENT_TEAM;
  const seed = options.seed ?? 1;
  const newBattle = () => createBattle([player, opponentTeam], { roundFrames: options.roundFrames });

  let battle = newBattle();
  let history: HistoryEntry[] = [];
  let advantage = createAdvantageTracker();
  let debug = false;
  let opponent: Opponent = options.opponent ?? 'stand';
  let style: Style = options.style ?? 'balanced';
  let infinitePp = false;
  let flash = 0;
  let effect: EffectMessage | null = null;
  const enter = (sides: [boolean, boolean], first: boolean): Entrance | null =>
    options.entrance && (sides[0] || sides[1]) ? { frame: 0, sides, first } : null;
  let entrance = enter([true, true], true);

  const newCpu = (): CpuState | null => {
    const difficulty = difficultyOf(opponent);
    return difficulty ? createCpu(1, makeProfile(difficulty, style), seed) : null;
  };
  let cpu = newCpu();

  const director = options.director ?? null;
  const tools = options.tools ?? director === null;

  const player2Input = (): InputMask => {
    if (director) return battle.phase === 'fight' ? director.input(battle.round) : 0;
    if (!cpu) return dummyInput(opponent as DummyMode, battle.round.frame + 1);
    // The CPU only plays during the fight itself (not on the KO pause or the menus).
    if (battle.phase !== 'fight') return 0;
    const decision = cpuStep(cpu, battle.round);
    cpu = decision.cpu;
    return decision.input;
  };

  return {
    tick(p1) {
      // While the trainers throw their Poké Balls, the fight waits (inputs do nothing).
      if (entrance) {
        entrance = entrance.frame + 1 >= ENTRANCE.total ? null : { ...entrance, frame: entrance.frame + 1 };
        return [];
      }
      // Who started the round that is ending (the opponent's replacement is picked before the player's choice).
      const before = [...battle.roundActive];
      const result = battleStep(battle, [p1, player2Input()]);
      battle = result.battle;
      // Training only: the sandbox refills PP outside the fight rules.
      if (infinitePp) for (const f of battle.round.fighters) f.pp = PP_MAX;
      const fightEvents = result.events.filter((e): e is FightEvent => e.type !== 'roundStart' && e.type !== 'battleOver');
      if (director && battle.phase === 'fight') director.after(battle.round, fightEvents);
      history = pushHistory(history, cleanDirections(p1));
      // A new round: a new frame-advantage measurement, and the CPU forgets the Pokémon it was fighting.
      if (result.events.some(e => e.type === 'roundStart')) {
        advantage = createAdvantageTracker();
        if (cpu) cpu = resetCpuMemory(cpu);
        // Only the side whose Pokémon changed throws a new ball.
        entrance = enter([battle.active[0] !== before[0], battle.active[1] !== before[1]], false);
      }
      advantage = trackAdvantage(advantage, battle.round, fightEvents);
      flash = result.events.some(e => e.type === 'hit' && e.big) ? BIG_HIT_FLASH : Math.max(0, flash - 1);
      effect = effect && effect.frames > 1 ? { ...effect, frames: effect.frames - 1 } : null;
      for (const e of result.events) {
        const text = e.type === 'hit' ? effectText(e.effectiveness) : null;
        if (e.type === 'hit' && text) effect = { text, fighter: e.defender, frames: EFFECT_FRAMES };
      }
      return result.events;
    },
    setPlayerTeam(team) {
      player = team;
      this.reset();
    },
    trySwitch() {
      if (entrance || director) return 'busy';
      const asked = requestSwitch(battle);
      battle = asked.battle;
      return asked.result;
    },
    reset() {
      battle = newBattle();
      entrance = enter([true, true], true);
      advantage = createAdvantageTracker();
      flash = 0;
      effect = null;
      cpu = newCpu();
    },
    toggleDebug() {
      if (tools) debug = !debug;
    },
    cycleOpponent() {
      if (!tools) return;
      opponent = OPPONENTS[(OPPONENTS.indexOf(opponent) + 1) % OPPONENTS.length];
      cpu = newCpu();
    },
    cycleStyle() {
      if (!tools) return;
      style = STYLES[(STYLES.indexOf(style) + 1) % STYLES.length];
      cpu = newCpu();
    },
    toggleInfinitePp() {
      if (tools) infinitePp = !infinitePp;
    },
    view: () => ({
      battle,
      debug,
      opponent,
      style,
      cpu: director ? director.describe() : cpu ? describeCpu(cpu) : null,
      infinitePp,
      history,
      advantage: advantage.last,
      flash,
      effect,
      banner: entrance
        ? null
        : (director?.banner() ?? (options.intro && battle.rounds === 1 && battle.round.frame < INTRO_FRAMES ? options.intro : null)),
      tools,
      switching: !director,
      stage: options.stage ?? { id: 'stadium' },
      trainers: options.trainers ?? [null, null],
      entrance,
    }),
  };
}
