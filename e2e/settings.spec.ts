// The player's settings (the Options screen: keys, sound, language) and moving around the menus without a mouse.

import { expect, fixture, openGame, reload, snapshot, step, test } from './helpers';

const SETTINGS_KEY = 'poke-fight.settings';
const storedSettings = (page: import('@playwright/test').Page) =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), SETTINGS_KEY);

test.describe('controls', () => {
  test('the tackle moves to U: the new key tackles, J does nothing, and it is remembered', async ({ page }) => {
    await openGame(page, { scene: 'title' });
    await page.getByTestId('options').click();
    await expect(page.getByTestId('bind-physical-key')).toHaveText('J');
    await page.getByTestId('change-physical').click();
    await expect(page.getByTestId('bind-physical')).toHaveClass(/waiting/);
    await page.keyboard.press('u');
    await expect(page.getByTestId('bind-physical-key')).toHaveText('U');
    expect((await storedSettings(page)).keys.physical).toBe('KeyU');

    await reload(page);
    await page.getByTestId('options').click();
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
    await page.getByTestId('options').click();
    await page.getByTestId('change-physical').click();
    await page.keyboard.press('k');
    await expect(page.getByTestId('bind-physical-key')).toHaveText('K');
    await expect(page.getByTestId('bind-special-key')).toHaveText('J');

    await page.getByTestId('change-guard').click();
    await page.keyboard.press('p');
    await expect(page.getByTestId('bind-guard-key')).toHaveText('L');
    await expect(page.getByTestId('options-info')).toContainText('belongs to the game');

    await page.getByTestId('change-dash').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('bind-dash-key')).toHaveText('Space');
    // Esc only cancelled the change: still on Options.
    await expect(page.getByTestId('options')).toBeVisible();

    await page.getByTestId('controls-reset').click();
    await expect(page.getByTestId('bind-physical-key')).toHaveText('J');
    await expect(page.getByTestId('bind-special-key')).toHaveText('K');
  });

  test('from the city, Back (or Esc) returns to the city', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
    await page.getByTestId('city-options').click();
    await expect(page.getByTestId('options')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city')).toBeVisible();
  });
});

test('sound: the Options switch and M turn it off and on, and it is remembered', async ({ page }) => {
  await openGame(page, { scene: 'title' });
  await page.getByTestId('options').click();
  await expect(page.getByTestId('sound')).toContainText('On (M)');
  await page.getByTestId('sound').click();
  await expect(page.getByTestId('sound')).toContainText('Off (M)');
  expect((await storedSettings(page)).muted).toBe(true);
  await reload(page);
  await page.getByTestId('options').click();
  await expect(page.getByTestId('sound')).toContainText('Off (M)');
  await page.keyboard.press('m');
  expect((await storedSettings(page)).muted).toBe(false);
});

test('the language chosen on the title is remembered without a saved game', async ({ page }) => {
  await openGame(page, { scene: 'title' });
  await page.getByTestId('options').click();
  await page.getByTestId('language-pt').click();
  await reload(page);
  await expect(page.getByTestId('new-game')).toHaveText('Novo jogo');
});

test.describe('menus without a mouse', () => {
  test('the title: arrows move through the menu (wrapping around), Enter presses', async ({ page }) => {
    await openGame(page, { scene: 'title' });
    // No save: "New game" is the main option and has the focus.
    await expect(page.getByTestId('new-game')).toBeFocused();
    await expect(page.getByTestId('title-description')).toHaveText('Start a new journey in Pallet Town');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('training')).toBeFocused();
    await expect(page.getByTestId('title-description')).toContainText('Lv. 30');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(page.getByTestId('options')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('training')).toBeFocused();
    await page.keyboard.press('Enter');
    expect((await page.evaluate(() => window.__pf!.scene())).scene).toBe('fight');
  });

  test('the city is a grid: arrows move by direction', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
    // Pewter: grass, cave, gym, battle field on top; Center, Mart, box, map below.
    await expect(page.getByTestId('hunt-grass')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('hunt-cave')).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByTestId('city-shop')).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByTestId('city-center')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('center')).toBeVisible();
    // Esc is the screen's Back button.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city')).toBeVisible();
  });

  test('the party: pick a Pokémon up and put it first (the lead)', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
    await page.keyboard.press('p');
    await page.getByTestId('member-2').click();
    await expect(page.getByTestId('party-moving')).toContainText('Machoke');
    await page.getByTestId('member-0').click();
    await expect(page.getByTestId('member-0')).toContainText('Machoke');
    await expect(page.getByTestId('member-2')).toContainText('Charmeleon');
    expect((await page.evaluate(() => window.__pf!.save().party.map(p => p.speciesId)))).toEqual([67, 64, 5]);
    // B / Esc cancels a pick-up instead of closing the party.
    await page.getByTestId('member-1').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('party-moving')).toHaveCount(0);
    await expect(page.getByTestId('party')).toBeVisible();
  });
});

test('menus show the Pokémon’s pictures (party, box)', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
  await page.getByTestId('city-box').click();
  await expect(page.getByTestId('party-0').locator('img.sprite')).toHaveAttribute('src', /sprites\/pokemon\/.*\.png$/);
});
