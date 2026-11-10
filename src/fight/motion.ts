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
 * Whether the history ends with down, down (two separate presses: down, let go, down again) within MOTION.window
 * frames, the attack at most MOTION.press frames after the second down: a legendary's move (plan.md §4.9). Down does
 * nothing else in this game, so it can't happen by accident, and it never moves the fighter. (Up, down, back,
 * forward was planned, but up jumps.)
 */
export function doubleDownDone(history: readonly InputMask[]): boolean {
  const down = (i: number) => i < history.length && has(history[i], Button.Down);
  // The second press: the oldest frame of the newest run of down, reached at most MOTION.press frames ago.
  let i = 0;
  while (i <= MOTION.press && !down(i)) i++;
  if (i > MOTION.press) return false;
  while (down(i + 1)) i++;
  const second = i;
  // A frame without down before it, then the first press.
  let j = second + 1;
  if (down(j)) return false;
  while (j < history.length && !down(j)) j++;
  if (!down(j)) return false;
  while (down(j + 1)) j++;
  return j - second + 1 <= MOTION.window;
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
