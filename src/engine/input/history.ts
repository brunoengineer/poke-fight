// The input history shown in the debug overlay: each different input and for how many frames it was held,
// newest first (like a training mode's input display).

import type { InputMask } from '../../fight/input';

export interface HistoryEntry {
  mask: InputMask;
  frames: number;
}

export const HISTORY_ROWS = 14;
/** Counts stop here (the display only has room for 2 digits). */
export const HISTORY_MAX_FRAMES = 99;

export function pushHistory(history: readonly HistoryEntry[], mask: InputMask, rows = HISTORY_ROWS): HistoryEntry[] {
  const [latest, ...rest] = history;
  if (latest && latest.mask === mask) {
    return [{ mask, frames: Math.min(HISTORY_MAX_FRAMES, latest.frames + 1) }, ...rest];
  }
  return [{ mask, frames: 1 }, ...history].slice(0, rows);
}
