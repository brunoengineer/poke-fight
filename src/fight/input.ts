// What a player is holding on one frame, as a bit mask. The simulation only ever sees these masks, so a fight can
// be replayed from a list of numbers. Keyboard and controller both produce them (src/engine/input/).

export const Button = {
  Left: 1 << 0,
  Right: 1 << 1,
  Up: 1 << 2,
  Down: 1 << 3,
  Physical: 1 << 4,
  Special: 1 << 5,
  Big: 1 << 6,
  Guard: 1 << 7,
  Dash: 1 << 8,
  // Menu buttons: only the battle's menus read them (the fight ignores them). A controller's A also jumps and its B
  // is also the big special, so the menus need to tell "A" apart from "up".
  Confirm: 1 << 9,
  Cancel: 1 << 10,
} as const;

export type InputMask = number;

export const has = (mask: InputMask, button: number) => (mask & button) !== 0;

/**
 * Opposite directions cancel out (left + right = neither, up + down = neither), so no combination of keys can do two
 * contradictory things at once. Fighting games call this SOCD cleaning.
 */
export function cleanDirections(mask: InputMask): InputMask {
  let clean = mask;
  if (has(clean, Button.Left) && has(clean, Button.Right)) clean &= ~(Button.Left | Button.Right);
  if (has(clean, Button.Up) && has(clean, Button.Down)) clean &= ~(Button.Up | Button.Down);
  return clean;
}
