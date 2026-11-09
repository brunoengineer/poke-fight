// The motion input with the real keyboard: back, down, forward + J is the elemental special, without PP.

import { expect, openGame, snapshot, step, test } from './helpers';

/** Holds a key for one simulated frame, then lets it go. */
async function tap(page: import('@playwright/test').Page, key: string) {
  await page.keyboard.down(key);
  await step(page, 1);
  await page.keyboard.up(key);
}

test('← ↓ → J fires the elemental special and spends no PP', async ({ page }) => {
  await openGame(page);
  const before = await snapshot(page);
  const [me, dummy] = before.fighters;
  expect(me.facing).toBe(1);

  await tap(page, 'ArrowLeft');
  await tap(page, 'ArrowDown');
  await page.keyboard.down('ArrowRight');
  await page.keyboard.press('j');
  await step(page, 1);
  await page.keyboard.up('ArrowRight');
  expect((await snapshot(page)).fighters[0]).toMatchObject({ action: 'elemental', actionFrame: 1, pp: me.pp });

  // The projectile flies and lands; the bar stays where it was (a free special earns no PP either).
  await step(page, 14);
  expect((await snapshot(page)).projectiles).toHaveLength(1);
  await step(page, 60);
  const after = await snapshot(page);
  expect(after.fighters[1].hp).toBeLessThan(dummy.hp);
  expect(after.fighters[0].pp).toBe(me.pp);
});

test('walking back then forward + J, without down, is still a tackle', async ({ page }) => {
  await openGame(page);
  await tap(page, 'a');
  await page.keyboard.down('d');
  await page.keyboard.press('j');
  await step(page, 1);
  await page.keyboard.up('d');
  expect((await snapshot(page)).fighters[0].action).toBe('attack');
});
