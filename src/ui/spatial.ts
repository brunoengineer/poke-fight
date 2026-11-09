// Spatial navigation: from the focused button, which one is "up", "down", "left" or "right" on screen. Pure (it only
// sees rectangles), so a controller's d-pad and the arrow keys move through grids, rows and columns the way the eye
// expects, whatever the layout.

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type Direction = 'up' | 'down' | 'left' | 'right';

const center = (r: Rect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

/** How much two ranges overlap (0 when they don't). */
const overlap = (a1: number, a2: number, b1: number, b2: number) => Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));

/**
 * The best candidate in `direction` from `from` (an index into `candidates`), or -1.
 *   - Only candidates that lie in that direction count (past the current one's middle).
 *   - The nearest wins, and staying in the same row/column matters more than distance: the sideways offset counts
 *     double, and a candidate that shares the row/column (overlaps) gets a big bonus.
 *   - `wrap`: with nothing in that direction, go around to the far end of the same row/column (lists).
 */
export function pickInDirection(from: Rect, candidates: readonly Rect[], direction: Direction, wrap = false): number {
  const c = center(from);
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;
  let best = -1;
  let bestScore = Infinity;
  candidates.forEach((r, i) => {
    const rc = center(r);
    const along = (horizontal ? rc.x - c.x : rc.y - c.y) * sign;
    if (along <= 1) return;
    const across = Math.abs(horizontal ? rc.y - c.y : rc.x - c.x);
    const shares = horizontal
      ? overlap(r.top, r.top + r.height, from.top, from.top + from.height) > 0
      : overlap(r.left, r.left + r.width, from.left, from.left + from.width) > 0;
    // Edge-to-edge gap along the direction (0 when they touch).
    const gap = Math.max(
      0,
      horizontal
        ? sign > 0
          ? r.left - (from.left + from.width)
          : from.left - (r.left + r.width)
        : sign > 0
          ? r.top - (from.top + from.height)
          : from.top - (r.top + r.height),
    );
    const score = gap + across * 2 + (shares ? 0 : 10_000);
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  });
  if (best !== -1 || !wrap) return best;

  // Wrap around: the farthest candidate the other way that shares the row/column.
  let far = -1;
  let farthest = -Infinity;
  candidates.forEach((r, i) => {
    const shares = horizontal
      ? overlap(r.top, r.top + r.height, from.top, from.top + from.height) > 0
      : overlap(r.left, r.left + r.width, from.left, from.left + from.width) > 0;
    if (!shares || r === from) return;
    const rc = center(r);
    const back = (horizontal ? c.x - rc.x : c.y - rc.y) * sign;
    if (back > farthest) {
      farthest = back;
      far = i;
    }
  });
  return farthest > 1 ? far : -1;
}
