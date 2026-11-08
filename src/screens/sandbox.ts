// The fight sandbox (milestones 1–3): player 1's team against player 2's team, played by a training dummy or the
// CPU. No DOM here: main.ts feeds it the inputs and draws what view() returns, and the tests drive it directly.

import { pushHistory, type HistoryEntry } from '../engine/input/history';
import { createAdvantageTracker, trackAdvantage, type AdvantageTracker } from '../fight/advantage';
import { cpuStep, createCpu, describeCpu, resetCpuMemory, type CpuState } from '../fight/ai/cpu';
import { DIFFICULTIES, makeProfile, STYLES, type Difficulty, type Style } from '../fight/ai/profiles';
import { battleStep, createBattle, type BattleEvent, type BattleState, type TeamMember } from '../fight/battle';
import { PP_MAX } from '../fight/constants';
import { DUMMY_MODES, dummyInput, type DummyMode } from '../fight/dummy';
import { cleanDirections, type InputMask } from '../fight/input';
import type { FightEvent } from '../fight/state';
import { DUMMY_TEAM, PLAYER_TEAM } from './sandbox-teams';

/** Frames of white flash after a big special lands. */
export const BIG_HIT_FLASH = 8;

/** Who plays player 2: a dummy behavior or a CPU difficulty. F2 cycles through them. */
export const OPPONENTS = [...DUMMY_MODES, ...DIFFICULTIES.map(d => `cpu-${d}` as const)] as const;
export type Opponent = DummyMode | `cpu-${Difficulty}`;

export const isOpponent = (value: string): value is Opponent => (OPPONENTS as readonly string[]).includes(value);

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
}

export interface Sandbox {
  /** Simulates one frame with player 1's input. Returns that frame's events. */
  tick(p1: InputMask): BattleEvent[];
  reset(): void;
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
}

const difficultyOf = (opponent: Opponent): Difficulty | null =>
  opponent.startsWith('cpu-') ? (opponent.slice(4) as Difficulty) : null;

export function createSandbox(options: SandboxOptions = {}): Sandbox {
  const player = options.player ?? PLAYER_TEAM;
  const opponentTeam = options.opponentTeam ?? DUMMY_TEAM;
  const seed = options.seed ?? 1;
  const newBattle = () => createBattle([player, opponentTeam]);

  let battle = newBattle();
  let history: HistoryEntry[] = [];
  let advantage = createAdvantageTracker();
  let debug = false;
  let opponent: Opponent = options.opponent ?? 'stand';
  let style: Style = 'balanced';
  let infinitePp = false;
  let flash = 0;

  const newCpu = (): CpuState | null => {
    const difficulty = difficultyOf(opponent);
    return difficulty ? createCpu(1, makeProfile(difficulty, style), seed) : null;
  };
  let cpu = newCpu();

  const player2Input = (): InputMask => {
    if (!cpu) return dummyInput(opponent as DummyMode, battle.round.frame + 1);
    // The CPU only plays during the fight itself (not on the KO pause or the menus).
    if (battle.phase !== 'fight') return 0;
    const decision = cpuStep(cpu, battle.round);
    cpu = decision.cpu;
    return decision.input;
  };

  return {
    tick(p1) {
      const result = battleStep(battle, [p1, player2Input()]);
      battle = result.battle;
      // Training only: the sandbox refills PP outside the fight rules.
      if (infinitePp) for (const f of battle.round.fighters) f.pp = PP_MAX;
      history = pushHistory(history, cleanDirections(p1));
      const fightEvents = result.events.filter((e): e is FightEvent => e.type !== 'roundStart' && e.type !== 'battleOver');
      // A new round: a new frame-advantage measurement, and the CPU forgets the Pokémon it was fighting.
      if (result.events.some(e => e.type === 'roundStart')) {
        advantage = createAdvantageTracker();
        if (cpu) cpu = resetCpuMemory(cpu);
      }
      advantage = trackAdvantage(advantage, battle.round, fightEvents);
      flash = result.events.some(e => e.type === 'hit' && e.big) ? BIG_HIT_FLASH : Math.max(0, flash - 1);
      return result.events;
    },
    reset() {
      battle = newBattle();
      advantage = createAdvantageTracker();
      flash = 0;
      cpu = newCpu();
    },
    toggleDebug() {
      debug = !debug;
    },
    cycleOpponent() {
      opponent = OPPONENTS[(OPPONENTS.indexOf(opponent) + 1) % OPPONENTS.length];
      cpu = newCpu();
    },
    cycleStyle() {
      style = STYLES[(STYLES.indexOf(style) + 1) % STYLES.length];
      cpu = newCpu();
    },
    toggleInfinitePp() {
      infinitePp = !infinitePp;
    },
    view: () => ({
      battle,
      debug,
      opponent,
      style,
      cpu: cpu ? describeCpu(cpu) : null,
      infinitePp,
      history,
      advantage: advantage.last,
      flash,
    }),
  };
}
