import { describe, expect, it } from 'vitest';
import { frameSize, integerScale } from './screen';

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

describe('the 16:9 frame', () => {
  it.each([
    [1280, 800, 1280, 720],
    [1920, 1080, 1920, 1080],
    [1536, 730, 1297, 729],
    [800, 1200, 800, 450],
  ])('%i×%i → %i×%i', (width, height, frameWidth, frameHeight) => {
    expect(frameSize(width, height)).toEqual({ width: frameWidth, height: frameHeight });
  });
});
