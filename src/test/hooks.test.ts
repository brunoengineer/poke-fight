import { describe, expect, it } from 'vitest';
import { DEFAULT_TEST_SEED, readTestOptions } from './hooks';

describe('test options from the URL', () => {
  it('are off in a normal game', () => {
    expect(readTestOptions('')).toEqual({ enabled: false, manualClock: false, seed: DEFAULT_TEST_SEED });
  });

  it('turn on the manual clock in test mode', () => {
    expect(readTestOptions('?test=1')).toEqual({ enabled: true, manualClock: true, seed: DEFAULT_TEST_SEED });
  });

  it('can keep the real clock', () => {
    expect(readTestOptions('?test=1&clock=real').manualClock).toBe(false);
  });

  it('read the seed, and ignore a bad one', () => {
    expect(readTestOptions('?test=1&seed=42').seed).toBe(42);
    expect(readTestOptions('?test=1&seed=abc').seed).toBe(DEFAULT_TEST_SEED);
    expect(readTestOptions('?test=1&seed=1.5').seed).toBe(DEFAULT_TEST_SEED);
  });
});
