// The trainers' entrance: before the fight, the trainers throw their Poké Balls and the fight waits for it.
// (Every other browser test turns it off with `entrance: '0'`.)

import { expect, openGame, snapshot, step, test } from './helpers';

/** ENTRANCE.total in src/screens/entrance.ts (browser tests can't import game code). */
const ENTRANCE_FRAMES = 72;

test('the fight waits for the Poké Balls, then starts; walking does nothing meanwhile', async ({ page }) => {
  await openGame(page, { entrance: '1' });
  const start = (await snapshot(page)).fighters[0].x;
  await page.keyboard.down('d');
  await step(page, ENTRANCE_FRAMES - 1);
  expect((await snapshot(page)).frame).toBe(0);
  expect((await snapshot(page)).fighters[0].x).toBe(start);
  await step(page, 12);
  await page.keyboard.up('d');
  const after = await snapshot(page);
  expect(after.frame).toBeGreaterThan(0);
  expect(after.fighters[0].x).toBeGreaterThan(start);
});
