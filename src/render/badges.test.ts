// Cleaning a badge: the white rim on its outer edge goes, its own white inside stays.

import { describe, expect, it } from 'vitest';
import { trimWhiteRim } from './badges';

/** A 5×5 badge: a white rim, a dark ring inside it, a white highlight in the middle. */
function badge() {
  const size = 5;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const rim = x === 0 || y === 0 || x === 4 || y === 4;
      const center = x === 2 && y === 2;
      const v = rim || center ? 255 : 30;
      data.set([v, v, v, 255], i);
    }
  }
  return data;
}
const alphaAt = (data: Uint8ClampedArray, x: number, y: number) => data[(y * 5 + x) * 4 + 3];

describe('cleaning a badge', () => {
  it('clears the white rim, keeps the dark outline and the white inside', () => {
    const data = badge();
    expect(trimWhiteRim(data, 5, 5)).toBe(16);
    expect(alphaAt(data, 0, 0)).toBe(0);
    expect(alphaAt(data, 1, 1)).toBe(255);
    expect(alphaAt(data, 2, 2)).toBe(255);
  });
});
