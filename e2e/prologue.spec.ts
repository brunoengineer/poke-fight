// The prologue, played for real: title → the Professor → names → starter → the rival tutorial → Pallet Town.

import type { Page } from '@playwright/test';
import { expect, fixture, openGame, reload, save, scene, snapshot, step, test } from './helpers';

const tutorialStep = async (page: Page) => (await scene(page)).tutorialStep;
const distance = async (page: Page) => {
  const [me, rival] = (await snapshot(page)).fighters;
  return Math.abs(rival.x - me.x) / 256;
};
const next = (page: Page) => page.getByTestId('dialog-next').click();

/** Holds a key for some frames. */
async function hold(page: Page, keys: string[], frames: number) {
  for (const key of keys) await page.keyboard.down(key);
  await step(page, frames);
  for (const key of keys) await page.keyboard.up(key);
}

/** Plays one tutorial step the way its instruction says, until the tutorial moves on. */
async function playStep(page: Page, name: string) {
  for (let attempt = 0; attempt < 30 && (await tutorialStep(page)) === name; attempt++) {
    switch (name) {
      case 'move':
        await hold(page, ['d'], 40);
        break;
      case 'jump':
        await page.keyboard.press('w');
        await step(page, 45);
        break;
      case 'tackle':
        while ((await distance(page)) > 40) await hold(page, ['d'], 4);
        await page.keyboard.press('j');
        await step(page, 30);
        break;
      case 'air': {
        // A jump-in from mid range, attacking on the way down.
        while ((await distance(page)) > 90) await hold(page, ['d'], 2);
        while ((await distance(page)) < 60) await hold(page, ['a'], 2);
        await hold(page, ['w', 'd'], 4);
        for (let frame = 0; frame < 40; frame++) {
          const me = (await snapshot(page)).fighters[0];
          if (me.vy < 0 && me.y < 80 * 256) break;
          await step(page, 1);
        }
        await page.keyboard.press('j');
        await step(page, 40);
        break;
      }
      case 'guard':
        await hold(page, ['l'], 60);
        break;
      case 'dash':
        await page.keyboard.press('Space');
        await step(page, 25);
        break;
      case 'special':
        await page.keyboard.press('k');
        await step(page, 40);
        break;
    }
  }
  expect(await tutorialStep(page), `stuck on the "${name}" step`).not.toBe(name);
}

test.describe('title', () => {
  test('without a save: New game and Training; no Continue', async ({ page }) => {
    await openGame(page, { scene: 'title' });
    await expect(page.getByTestId('title').getByRole('heading', { name: 'Poké Fight' })).toBeVisible();
    await expect(page.getByTestId('new-game')).toBeVisible();
    await expect(page.getByTestId('training')).toBeVisible();
    await expect(page.getByTestId('continue-game')).toHaveCount(0);
  });

  test('Training without a journey is the demo: Esc goes back to the title', async ({ page }) => {
    await openGame(page, { scene: 'title' });
    await page.getByTestId('training').click();
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'demo' });
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('title')).toBeVisible();
  });
});

test.describe('the prologue', () => {
  test('from New game to Pallet Town, through the whole rival tutorial', async ({ page }) => {
    test.setTimeout(120_000);
    await openGame(page, { scene: 'title' });
    await page.getByTestId('new-game').click();
    await expect(page.getByTestId('dialog-text')).toContainText('Welcome to Pallet Town');
    await next(page);
    await next(page);

    // Names.
    await page.getByTestId('name-input').fill('Ana');
    await page.getByTestId('dialog-ok').click();
    await page.getByTestId('name-input').fill('Bia');
    await page.getByTestId('dialog-ok').click();
    await expect(page.getByTestId('dialog-text')).toHaveText('Ana, pick your first partner!');
    await next(page);

    // The starter: the Professor teaches it its first type move; the rival takes the one that beats it.
    await page.getByTestId('starter-charmander').click();
    await expect(page.getByTestId('dialog-text')).toHaveText('Charmander is yours! I will teach it Ember, its first Fire move.');
    await next(page);
    await expect(page.getByTestId('dialog')).toContainText('Bia');
    await expect(page.getByTestId('dialog-text')).toContainText('Then I take Squirtle!');
    await next(page);
    await next(page);

    const started = await save(page);
    expect(started).toMatchObject({ player: { name: 'Ana' }, rival: { name: 'Bia', starterId: 7 }, prologue: 'tutorial', starterId: 4 });
    expect(started.party[0].moves).toContain('ember');
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'tutorial', tutorialStep: 'move' });

    for (const name of ['move', 'jump', 'tackle', 'air', 'guard', 'dash', 'special']) await playStep(page, name);
    expect(await tutorialStep(page)).toBe('finish');

    // The free fight: walk in and tackle until it's over.
    await page.keyboard.down('d');
    for (let i = 0; i < 200 && !(await page.getByTestId('results').isVisible()); i++) {
      await page.keyboard.press('j');
      await step(page, 30);
    }
    await page.keyboard.up('d');
    await expect(page.getByTestId('results')).toBeVisible();
    await page.getByTestId('continue').click();

    // The rival and the Professor, then the city.
    await expect(page.getByTestId('dialog')).toContainText('Bia');
    while (await page.getByTestId('dialog-next').isVisible()) await next(page);
    await expect(page.getByTestId('city-heading')).toHaveText('Pallet Town');
    expect(await save(page)).toMatchObject({ prologue: 'done', location: 'pallet' });

    // Continue from the title goes back to the city.
    await reload(page);
    await page.getByTestId('continue-game').click();
    await expect(page.getByTestId('city-heading')).toHaveText('Pallet Town');
  });

  test('empty names become the default ones', async ({ page }) => {
    await openGame(page, { scene: 'title' });
    await page.getByTestId('new-game').click();
    await next(page);
    await next(page);
    await page.getByTestId('name-input').fill('   ');
    await page.getByTestId('dialog-ok').click();
    await page.getByTestId('name-input').fill('');
    await page.getByTestId('dialog-ok').click();
    await expect(page.getByTestId('dialog-text')).toHaveText('Kai, pick your first partner!');
  });

  test('Continue in the middle of the prologue goes back to the rival tutorial', async ({ page }) => {
    await openGame(page, { scene: 'title' }, { save: fixture('save-v2-tutorial.json') });
    await expect(page.getByTestId('continue-info')).toContainText('Kai');
    await page.getByTestId('continue-game').click();
    await next(page);
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'tutorial', tutorialStep: 'move' });
    // The tutorial has no training tools.
    await page.keyboard.press('F2');
    await page.keyboard.press('Escape');
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'tutorial' });
  });
});

test.describe('the city', () => {
  test('Training from the city fights with your party; Esc goes back to the city', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fixture('save-v2-viridian.json') });
    await expect(page.getByTestId('city-heading')).toHaveText('Viridian City');
    await page.getByTestId('city-training').click();
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'trainer' });
    // Opponents at the party's level.
    const [mine, theirs] = (await snapshot(page)).fighters;
    expect(theirs.level).toBe(mine.level);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city-heading')).toBeVisible();
  });
});
