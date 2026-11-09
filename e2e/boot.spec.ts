// The game starts, shows its screen at a whole-number scale, and the test clock behaves.

import { expect, frame, openGame, step, test } from './helpers';

test('shows the fight screen at a whole-number scale', async ({ page }) => {
  await openGame(page);
  const screen = page.getByTestId('screen');
  await expect(screen).toBeVisible();
  // 1280×800 window → ×2 → 960×540.
  await expect(screen).toHaveJSProperty('width', 480);
  await expect(screen).toHaveJSProperty('height', 270);
  expect(await screen.boundingBox()).toMatchObject({ width: 960, height: 540 });
});

test('rescales when the window changes size', async ({ page }) => {
  await openGame(page);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect.poll(async () => (await page.getByTestId('screen').boundingBox())?.width).toBe(1920);
});

test('with the manual clock, the game only moves when the test steps it', async ({ page }) => {
  await openGame(page);
  expect(await frame(page)).toBe(0);
  // Real time passes, but the game stays on frame 0.
  await page.waitForTimeout(300);
  expect(await frame(page)).toBe(0);
  expect(await step(page, 1)).toBe(1);
  expect(await step(page, 59)).toBe(60);
  expect(await frame(page)).toBe(60);
});

test('with the real clock, the game runs on its own', async ({ page }) => {
  await openGame(page, { clock: 'real' });
  await expect.poll(() => frame(page)).toBeGreaterThan(10);
});

test('passes the seed from the URL to the game', async ({ page }) => {
  await openGame(page, { seed: '1234' });
  expect(await page.evaluate(() => window.__pf!.seed)).toBe(1234);
});

test('test hooks do not exist in a normal game', async ({ page }) => {
  await page.goto('/');
  // A normal game starts on the title screen (the fight canvas only shows during fights).
  await expect(page.getByTestId('title')).toBeVisible();
  expect(await page.evaluate(() => window.__pf)).toBeUndefined();
});
