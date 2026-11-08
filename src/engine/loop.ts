// The fixed-step clock: the simulation always advances in whole 1/60 s steps, whatever the monitor's refresh rate
// (60, 120, 144 Hz…) or the machine's speed. Rendering happens once per browser frame and only reads the state.

export const STEPS_PER_SECOND = 60;
export const STEP_MS = 1000 / STEPS_PER_SECOND;

/** After a long pause (background tab, breakpoint), run at most this many steps, then drop the backlog. */
export const MAX_STEPS_PER_ADVANCE = 5;

/** Absorbs floating-point error, so 144 frames of 1000/144 ms add up to exactly 60 steps. */
const EPSILON_MS = 1e-6;

export interface FixedStep {
  /** Adds real elapsed time and runs as many whole steps as fit. Returns how many steps ran. */
  advance(elapsedMs: number): number;
}

export function createFixedStep(step: () => void): FixedStep {
  let pending = 0;
  return {
    advance(elapsedMs) {
      pending += Math.max(0, elapsedMs);
      let ran = 0;
      while (pending + EPSILON_MS >= STEP_MS && ran < MAX_STEPS_PER_ADVANCE) {
        step();
        pending -= STEP_MS;
        ran++;
      }
      // Catching up on a long pause would fast-forward the fight. Skip the rest instead.
      if (pending + EPSILON_MS >= STEP_MS) pending = 0;
      pending = Math.max(0, pending);
      return ran;
    },
  };
}
