// Playing the menus with a controller (a fake one: the game reads it like a real pad, through the Gamepad API).

import { expect, fakePad, fixture, openGame, PAD, test } from './helpers';

test('the d-pad moves through the city by direction, A opens, B goes back, Y opens the party', async ({ page }) => {
  const pad = await fakePad(page);
  await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
  await expect(page.getByTestId('hunt-grass')).toBeFocused();
  await pad.press(PAD.Right);
  await expect(page.getByTestId('hunt-cave')).toBeFocused();
  await pad.press(PAD.Down);
  await expect(page.getByTestId('city-shop')).toBeFocused();
  // The hints switch to the controller's glyphs.
  await expect(page.getByTestId('frame')).toHaveAttribute('data-input', 'pad');
  await pad.press(PAD.A);
  await expect(page.getByTestId('shop')).toBeVisible();
  await pad.press(PAD.B);
  await expect(page.getByTestId('city')).toBeVisible();
  await pad.press(PAD.Y);
  await expect(page.getByTestId('party')).toBeVisible();
  await pad.press(PAD.B);
  await expect(page.getByTestId('city')).toBeVisible();
});

test('the shop: A buys the focused item and keeps the focus on it', async ({ page }) => {
  const pad = await fakePad(page);
  await openGame(page, { scene: 'city' }, { save: { ...(fixture('save-v4-team.json') as object), money: 5000 } });
  await page.getByTestId('city-shop').focus();
  await pad.press(PAD.A);
  await expect(page.getByTestId('buy-poke-ball')).toBeFocused();
  await pad.press(PAD.A);
  await pad.press(PAD.A);
  await expect(page.getByTestId('item-poke-ball')).toContainText('You have 7');
  await expect(page.getByTestId('buy-poke-ball')).toBeFocused();
});

test('a dialog: A goes on; a yes / no question: B answers no', async ({ page }) => {
  const pad = await fakePad(page);
  await openGame(page, { scene: 'title' }, { save: fixture('save-v4-team.json') });
  // With a save, New game asks first.
  await page.getByTestId('new-game').focus();
  await pad.press(PAD.A);
  await expect(page.getByTestId('dialog-yes')).toBeVisible();
  await pad.press(PAD.B);
  await expect(page.getByTestId('title')).toBeVisible();
});
