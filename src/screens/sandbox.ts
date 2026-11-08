// The fight sandbox (milestones 1–3): player 1 against a training dummy. No DOM here: main.ts feeds it the inputs
// and draws what view() returns, and the tests drive it directly.

import { createAdvantageTracker, trackAdvantage, type AdvantageTracker } from '../fight/advantage';
import { dummyInput, nextDummyMode, type DummyMode } from '../fight/dummy';
import { cleanDirections, type InputMask } from '../fight/input';
import { createFight, type FightEvent, type FightState } from '../fight/state';
import { step } from '../fight/step';
import { pushHistory, type HistoryEntry } from '../engine/input/history';

export interface SandboxView {
  state: FightState;
  debug: boolean;
  dummy: DummyMode;
  history: readonly HistoryEntry[];
  advantage: number | null;
}

export interface Sandbox {
  /** Simulates one frame with player 1's input. Returns that frame's events. */
  tick(p1: InputMask): FightEvent[];
  reset(): void;
  toggleDebug(): void;
  cycleDummy(): void;
  view(): SandboxView;
}

export function createSandbox(): Sandbox {
  let state = createFight();
  let history: HistoryEntry[] = [];
  let advantage: AdvantageTracker = createAdvantageTracker();
  let debug = false;
  let dummy: DummyMode = 'stand';

  return {
    tick(p1) {
      const result = step(state, [p1, dummyInput(dummy, state.frame + 1)]);
      state = result.state;
      history = pushHistory(history, cleanDirections(p1));
      advantage = trackAdvantage(advantage, state, result.events);
      return result.events;
    },
    reset() {
      state = createFight();
      advantage = createAdvantageTracker();
    },
    toggleDebug() {
      debug = !debug;
    },
    cycleDummy() {
      dummy = nextDummyMode(dummy);
    },
    view: () => ({ state, debug, dummy, history, advantage: advantage.last }),
  };
}
