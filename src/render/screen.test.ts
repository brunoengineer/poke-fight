import { describe, expect, it } from 'vitest';
import { canvasFit, frameSize, integerScale } from './screen';

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

describe('the fight canvas, in device pixels', () => {
  it('a whole number of device pixels per art pixel, at any display scaling', () => {
    // 1280×720 frame: ×2 at 100%; at 125% (1600×900 device pixels) ×3; at 150% (1920×1080) ×4.
    expect(canvasFit(1280, 720, 1)).toMatchObject({ scale: 2, width: 960, height: 540, cssWidth: 960, left: 160, top: 90 });
    expect(canvasFit(1280, 720, 1.25)).toMatchObject({ scale: 3, width: 1440, height: 810 });
    expect(canvasFit(1280, 720, 1.5)).toMatchObject({ scale: 4, width: 1920, height: 1080, cssWidth: 1280, left: 0 });
  });

  it('it sits on whole device pixels (no half-pixel blur)', () => {
    const fit = canvasFit(1297, 729, 1.25);
    expect(Number.isInteger(fit.left * 1.25)).toBe(true);
    expect(Number.isInteger(fit.top * 1.25)).toBe(true);
    expect(fit.cssWidth * 1.25).toBe(fit.width);
  });
});
