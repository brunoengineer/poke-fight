import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const take = (rng: ReturnType<typeof createRng>, n: number) => Array.from({ length: n }, () => rng.next());

describe('seeded rng', () => {
  it('gives the same sequence for the same seed', () => {
    expect(take(createRng(42), 20)).toEqual(take(createRng(42), 20));
  });

  it('gives a different sequence for a different seed', () => {
    expect(take(createRng(1), 20)).not.toEqual(take(createRng(2), 20));
  });

  it('continues the same sequence from a saved state', () => {
    const rng = createRng(7);
    take(rng, 5);
    const resumed = createRng(rng.state);
    expect(take(resumed, 10)).toEqual(take(rng, 10));
  });

  it('stays in [0, 1) and int() stays in range', () => {
    const rng = createRng(123);
    for (let i = 0; i < 10_000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
      const roll = rng.int(6);
      expect(Number.isInteger(roll) && roll >= 0 && roll < 6).toBe(true);
    }
  });

  it('is roughly uniform', () => {
    const rng = createRng(99);
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100_000; i++) buckets[rng.int(10)]++;
    for (const count of buckets) expect(Math.abs(count - 10_000)).toBeLessThan(500);
  });
});
