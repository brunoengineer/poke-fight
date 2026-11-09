// Switching Pokémon during a battle: once mid-round; again only after a Pokémon faints. After every faint, the
// player picks who fights the next round.

import { battle, expect, fakePad, fixture, openGame, PAD, snapshot, step, test } from './helpers';

/** The battle field from Pewter with the Lv. 30 team (Charmeleon, Kadabra, Machoke) against a standing dummy. */
const open = (page: import('@playwright/test').Page) => openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') }).then(() => page.getByTestId('city-training').click());

test('Tab opens the choice; the new Pokémon comes in and the opponent keeps its HP', async ({ page }) => {
  await open(page);
  await step(page, 10);
  const before = await snapshot(page);
  await page.keyboard.press('Tab');
  await step(page, 1);
  expect(await battle(page)).toMatchObject({ phase: 'choose', chooseReason: 'switch' });
  await page.keyboard.press('s');
  await step(page, 1);
  await page.keyboard.press('j');
  await step(page, 1);
  const after = await snapshot(page);
  expect(after.fighters[0].name).toBe('Kadabra');
  expect(after.fighters[1]).toMatchObject({ name: before.fighters[1].name, hp: before.fighters[1].hp });
});

test('a second switch before anyone faints is refused, with a message', async ({ page }) => {
  await open(page);
  await step(page, 10);
  await page.keyboard.press('Tab');
  await step(page, 1);
  await page.keyboard.press('s');
  await step(page, 1);
  await page.keyboard.press('j');
  await step(page, 5);
  await page.keyboard.press('Tab');
  await step(page, 1);
  expect((await battle(page)).phase).toBe('fight');
  await expect(page.getByTestId('toast')).toHaveText('You already switched. You can switch again after a Pokémon faints.');
});

test('after the opponent faints, the player picks who fights next; then it can switch again', async ({ page }) => {
  await open(page);
  // Walk in and tackle until the first opponent faints and the choice appears.
  await page.keyboard.down('d');
  for (let i = 0; i < 60 && (await battle(page)).phase !== 'choose'; i++) {
    await page.keyboard.press('j');
    await step(page, 30);
  }
  await page.keyboard.up('d');
  expect(await battle(page)).toMatchObject({ phase: 'choose', chooseReason: 'next', switchReady: true });
  // Keep Charmeleon (already selected).
  await page.keyboard.press('j');
  await step(page, 1);
  expect((await snapshot(page)).fighters[0].name).toBe('Charmeleon');
});

test('a controller switches with the View button', async ({ page }) => {
  const pad = await fakePad(page);
  await open(page);
  await step(page, 10);
  await pad.press(PAD.Back);
  await step(page, 1);
  expect(await battle(page)).toMatchObject({ phase: 'choose', chooseReason: 'switch' });
});
