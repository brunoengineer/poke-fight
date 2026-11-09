import { describe, expect, it } from 'vitest';
import { pickInDirection, type Rect } from './spatial';

const box = (left: number, top: number, width = 100, height = 50): Rect => ({ left, top, width, height });

describe('spatial navigation', () => {
  // A 3×2 grid:  0 1 2
  //              3 4 5
  const grid = [box(0, 0), box(120, 0), box(240, 0), box(0, 70), box(120, 70), box(240, 70)];

  it('moves through a grid in the four directions', () => {
    expect(pickInDirection(grid[0], grid, 'right')).toBe(1);
    expect(pickInDirection(grid[1], grid, 'down')).toBe(4);
    expect(pickInDirection(grid[4], grid, 'left')).toBe(3);
    expect(pickInDirection(grid[5], grid, 'up')).toBe(2);
  });

  it('stops at the edges unless asked to wrap', () => {
    expect(pickInDirection(grid[2], grid, 'right')).toBe(-1);
    expect(pickInDirection(grid[2], grid, 'right', true)).toBe(0);
    expect(pickInDirection(grid[0], grid, 'up', true)).toBe(3);
  });

  it('prefers staying in the same row over a closer button diagonally', () => {
    // From the left card, "right" goes to the far card on the same row, not the nearer one below it.
    const cards = [box(0, 0, 100, 100), box(110, 120, 40, 40), box(400, 20, 100, 60)];
    expect(pickInDirection(cards[0], cards, 'right')).toBe(2);
  });

  it('from a wide bar, "down" picks the button under the middle', () => {
    const layout = [box(0, 0, 600, 40), box(0, 60), box(250, 60), box(500, 60)];
    expect(pickInDirection(layout[0], layout, 'down')).toBe(2);
  });

  it('a column next to a grid: left from the grid lands on the nearest row', () => {
    const column = [box(0, 0, 80, 40), box(0, 50, 80, 40), box(0, 100, 80, 40)];
    const cells = [box(200, 45, 40, 40), box(250, 45, 40, 40)];
    const all = [...column, ...cells];
    expect(pickInDirection(cells[0], all, 'left')).toBe(1);
  });
});
