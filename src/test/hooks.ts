// Test mode, for the Playwright tests: open the game with `?test=1`.
//   - The clock is manual: the game only advances when the test calls `window.__pf.step(n)`, so tests can check
//     exactly what happens on each frame, whatever the machine's speed. `&clock=real` keeps the real clock.
//   - The seed is fixed (`&seed=N`, default 1), so randomness is the same on every run.
//   - `window.__pf` gives read-only access to the game. Tests never change the state through it.

import type { ContactKind } from '../fight/advantage';
import type { BattleState } from '../fight/battle';
import type { FightState } from '../fight/state';

export interface TestOptions {
  enabled: boolean;
  manualClock: boolean;
  seed: number;
}

export const DEFAULT_TEST_SEED = 1;

export function readTestOptions(search: string): TestOptions {
  const params = new URLSearchParams(search);
  const enabled = params.has('test');
  const seed = Number(params.get('seed'));
  return {
    enabled,
    manualClock: enabled && params.get('clock') !== 'real',
    seed: Number.isInteger(seed) && params.has('seed') ? seed : DEFAULT_TEST_SEED,
  };
}

/** What the tests can see and do in the page. */
export interface TestApi {
  /** Simulation frames since the game started. */
  frame(): number;
  /** Advances the simulation by n frames (manual clock only) and draws the result. Returns the new frame. */
  step(frames: number): number;
  /** A copy of the current round's state. */
  snapshot(): FightState;
  /** A copy of the whole battle (teams, phase, round). */
  battle(): BattleState;
  /** Sandbox settings and the last measured frame advantage. */
  debug(): {
    overlay: boolean;
    opponent: string;
    style: string;
    infinitePp: boolean;
    advantage: { kind: ContactKind; value: number } | null;
  };
  /** Whether the clock only moves through step(). */
  manualClock: boolean;
  seed: number;
}

declare global {
  interface Window {
    __pf?: TestApi;
  }
}

export function installTestHooks(api: TestApi): void {
  window.__pf = api;
}
