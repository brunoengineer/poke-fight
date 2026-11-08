// The player's settings: the keyboard controls, sound on/off, and moving around the menus without a mouse.

import { expect, fixture, openGame, reload, snapshot, step, test } from './helpers';

const SETTINGS_KEY = 'poke-fight.settings';
const storedSettings = (page: import('@playwright/test').Page) =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), SETTINGS_KEY);

test.describe('controls', () => {
  test('the tackle moves to U: the new key tackles, J does nothing, and it is remembered', async ({ page }) => {
    await openGame(page, { scene: 'title' });
    await page.getByTestId('controls').click();
    await expect(page.getByTestId('bind-physical-key')).toHaveText('J');
    await page.getByTestId('change-physical').click();
    await expect(page.getByTestId('bind-physical')).toHaveClass(/waiting/);
    await page.keyboard.press('u');
    await expect(page.getByTestId('bind-physical-key')).toHaveText('U');
    expect((await storedSettings(page)).keys.physical).toBe('KeyU');

    await reload(page);
    await page.getByTestId('controls').click();
    await expect(page.getByTestId('bind-physical-key')).toHaveText('U');
    await page.getByTestId('back').click();
    await page.getByTestId('training').click();

    await page.keyboard.press('j');
    await step(page, 2);
    expect((await snapshot(page)).fighters[0].action).not.toBe('attack');
    await page.keyboard.press('u');
    await step(page, 2);
    expect((await snapshot(page)).fighters[0].action).toBe('attack');
  });

  test('a key another action uses: they swap; a game key is refused; Default keys restores', async ({ page }) => {
    await openGame(page, { scene: 'title' });
    await page.getByTestId('controls').click();
    await page.getByTestId('change-physical').click();
    await page.keyboard.press('k');
    await expect(page.getByTestId('bind-physical-key')).toHaveText('K');
    await expect(page.getByTestId('bind-special-key')).toHaveText('J');

    await page.getByTestId('change-guard').click();
    await page.keyboard.press('p');
    await expect(page.getByTestId('bind-guard-key')).toHaveText('L');
    await expect(page.getByTestId('controls-info-0')).toContainText('belongs to the game');

    await page.getByTestId('change-dash').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('bind-dash-key')).toHaveText('Space');

    await page.getByTestId('controls-reset').click();
    await expect(page.getByTestId('bind-physical-key')).toHaveText('J');
    await expect(page.getByTestId('bind-special-key')).toHaveText('K');
  });

  test('from the city, Back returns to the city', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
    await page.getByTestId('city-controls').click();
    await expect(page.getByTestId('controls')).toBeVisible();
    await page.getByTestId('back').click();
    await expect(page.getByTestId('city')).toBeVisible();
  });
});

test('sound: the title button and M switch it off and on, and it is remembered', async ({ page }) => {
  await openGame(page, { scene: 'title' });
  await expect(page.getByTestId('sound')).toHaveText('Sound: on (M)');
  await page.getByTestId('sound').click();
  await expect(page.getByTestId('sound')).toHaveText('Sound: off (M)');
  expect((await storedSettings(page)).muted).toBe(true);
  await reload(page);
  await expect(page.getByTestId('sound')).toHaveText('Sound: off (M)');
  await page.keyboard.press('m');
  await expect(page.getByTestId('sound')).toHaveText('Sound: on (M)');
});

test('menus: the arrow keys move between buttons, Enter presses', async ({ page }) => {
  await openGame(page, { scene: 'title' });
  // No save: "New game" is the main button and has the focus.
  await expect(page.getByTestId('new-game')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByTestId('training')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  // Wraps around to the last button.
  await expect(page.getByTestId('sound')).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(page.getByTestId('training')).toBeFocused();
  await page.keyboard.press('Enter');
  expect((await page.evaluate(() => window.__pf!.scene())).scene).toBe('fight');
});

test('menus show the Pokémon’s pictures (party, box)', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
  await page.getByTestId('city-box').click();
  await expect(page.getByTestId('party-0').locator('img.sprite')).toHaveAttribute('src', /sprites\/pokemon\/.*\.png$/);
});
