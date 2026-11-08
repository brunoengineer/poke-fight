import { describe, expect, it } from 'vitest';
import { integerScale } from './screen';

describe('integer scale', () => {
  it.each([
    [1280, 800, 2],
    [1920, 1080, 4],
    [2560, 1440, 5],
    [1440, 810, 3],
    [1439, 810, 2],
    [300, 200, 1],
  ])('%i×%i → ×%i', (width, height, scale) => {
    expect(integerScale(width, height)).toBe(scale);
  });
});
