// The hunting cards' Pokémon always fit their card (fixed after the Hidden Grove: League cities have two rows of short
// cards, and their sprites spilled out).

import { describe, expect, it } from 'vitest';
import { artArea, fitMonSize, monSize } from './city';

/** Rows needed by `count` sprites of `size` in `area` (as fitMonSize counts them), and their height. */
const usedHeight = (count: number, size: number, width: number) => Math.ceil(count / Math.max(1, Math.floor(width / (size * 0.74)))) * size * 0.66;

describe('hunting cards', () => {
  it('in a row of three or four tall cards, the usual sizes still fit (nothing changes there)', () => {
    for (const count of [3, 7, 12, 16]) expect(fitMonSize(count, artArea(4, false))).toBe(monSize(count));
  });

  it('in two rows of short cards, every ground up to 30 species fits, smaller when needed', () => {
    const area = artArea(3, true);
    for (let count = 1; count <= 30; count++) {
      const size = fitMonSize(count, area);
      expect(size).toBeLessThanOrEqual(monSize(count));
      expect(usedHeight(count, size, area.w), `${count} species`).toBeLessThanOrEqual(area.h);
    }
    // Sinnoh's grove (29) is the most crowded: small, but not tiny.
    expect(fitMonSize(29, area)).toBeGreaterThanOrEqual(5);
  });
});
