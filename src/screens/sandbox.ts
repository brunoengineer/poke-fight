// The fight sandbox (milestones 1–3): player 1's team against the training dummy's team. No DOM here: main.ts feeds
// it the inputs and draws what view() returns, and the tests drive it directly.

import { pushHistory, type HistoryEntry } from '../engine/input/history';
import { createAdvantageTracker, trackAdvantage, type AdvantageTracker } from '../fight/advantage';
import { battleStep, createBattle, type BattleEvent, type BattleState, type TeamMember } from '../fight/battle';
import { PP_MAX } from '../fight/constants';
import { dummyInput, nextDummyMode, type DummyMode } from '../fight/dummy';
import { cleanDirections, type InputMask } from '../fight/input';
import type { FightEvent } from '../fight/state';
import { DUMMY_TEAM, PLAYER_TEAM } from './sandbox-teams';

/** Frames of white flash after a big special lands. */
export const BIG_HIT_FLASH = 8;

export interface SandboxView {
  battle: BattleState;
  debug: boolean;
  dummy: DummyMode;
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
  cycleDummy(): void;
  toggleInfinitePp(): void;
  view(): SandboxView;
}

export interface SandboxTeams {
  player: TeamMember[];
  dummy: TeamMember[];
}

export function createSandbox(teams: SandboxTeams = { player: PLAYER_TEAM, dummy: DUMMY_TEAM }): Sandbox {
  const newBattle = () => createBattle([teams.player, teams.dummy]);
  let battle = newBattle();
  let history: HistoryEntry[] = [];
  let advantage = createAdvantageTracker();
  let debug = false;
  let dummy: DummyMode = 'stand';
  let infinitePp = false;
  let flash = 0;

  return {
    tick(p1) {
      const result = battleStep(battle, [p1, dummyInput(dummy, battle.round.frame + 1)]);
      battle = result.battle;
      // Training only: the sandbox refills PP outside the fight rules.
      if (infinitePp) for (const f of battle.round.fighters) f.pp = PP_MAX;
      history = pushHistory(history, cleanDirections(p1));
      const fightEvents = result.events.filter((e): e is FightEvent => e.type !== 'roundStart' && e.type !== 'battleOver');
      // A new round starts a new measurement (the last one belonged to other Pokémon).
      if (result.events.some(e => e.type === 'roundStart')) advantage = createAdvantageTracker();
      advantage = trackAdvantage(advantage, battle.round, fightEvents);
      flash = result.events.some(e => e.type === 'hit' && e.big) ? BIG_HIT_FLASH : Math.max(0, flash - 1);
      return result.events;
    },
    reset() {
      battle = newBattle();
      advantage = createAdvantageTracker();
      flash = 0;
    },
    toggleDebug() {
      debug = !debug;
    },
    cycleDummy() {
      dummy = nextDummyMode(dummy);
    },
    toggleInfinitePp() {
      infinitePp = !infinitePp;
    },
    view: () => ({ battle, debug, dummy, infinitePp, history, advantage: advantage.last, flash }),
  };
}
