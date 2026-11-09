// The motion input (plan.md §4.3): back, down, forward, then the physical attack button performs the elemental
// special for free (no PP spent, none earned). Directions are relative to the way the fighter faces: facing right it
// is ← ↓ →, facing left → ↓ ←.
//
// The fighter keeps the directions of its last frames in its state (Fighter.directions), so the check is pure and a
// replay of the same inputs always gives the same result.

import { Button, has, type InputMask } from './input';

export const MOTION = {
  /** Back, down and forward must all fit in this many frames, from the first back frame to forward (both counted). */
  window: 20,
  /** The attack must be pressed at most this many frames after forward is reached (0 = on the same frame). */
  press: 8,
} as const;

/** How many frames of directions a fighter remembers: enough for the slowest motion pressed as late as allowed. */
export const MOTION_HISTORY = MOTION.window + MOTION.press;

/** Only these matter for motions (up is left out: up + down cancel out anyway). */
const MOTION_BITS = Button.Left | Button.Right | Button.Down;

/** Adds this frame's directions (already cleaned of opposite directions) to the history, newest first. */
export function pushDirections(history: readonly InputMask[], mask: InputMask): InputMask[] {
  return [mask & MOTION_BITS, ...history].slice(0, MOTION_HISTORY);
}

/**
 * Whether the history (newest first; index 0 is the frame of the press) ends with back, down, forward.
 * A diagonal counts as both of its directions: down-back covers "back, down", down-forward covers "down, forward".
 * Each step is the first frame it is reached after the previous one, so holding forward for a while and then pressing
 * is too late.
 */
export function motionDone(history: readonly InputMask[], facing: 1 | -1): boolean {
  const forward = facing === 1 ? Button.Right : Button.Left;
  const back = facing === 1 ? Button.Left : Button.Right;
  // Older frames have higher indices. From a back frame, look forward in time (towards index 0) for down, then forward.
  const firstFrom = (from: number, button: number) => {
    for (let i = from; i >= 0; i--) if (has(history[i], button)) return i;
    return -1;
  };
  for (let b = 0; b < history.length; b++) {
    if (!has(history[b], back)) continue;
    const d = firstFrom(b, Button.Down);
    if (d < 0) continue;
    const f = firstFrom(d, forward);
    if (f < 0) continue;
    if (f <= MOTION.press && b - f + 1 <= MOTION.window) return true;
  }
  return false;
}
