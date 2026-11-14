// The Training Dojo (plan.md §5): in the League city, one Pokémon trains while the player fights; a level per battle,
// taken back for ₽2000. The save is a version 7 one at Indigo Plateau (Mewtwo Lv. 100 and Charizard Lv. 60, ₽3000).

import type { Page } from '@playwright/test';
import { expect, fixture, openGame, save, winBattle, test } from './helpers';

const indigo = (change: Record<string, unknown> = {}) => ({ ...(fixture('save-v7-indigo.json') as Record<string, unknown>), ...change });

/** A wild battle in Indigo's grass, won; whatever the results screen offers, back to the city. */
async function huntAndWin(page: Page) {
  await page.getByTestId('hunt-grass').click();
  await winBattle(page);
  const letGo = page.getByTestId('let-go');
  if (await letGo.isVisible()) await letGo.click();
  await page.getByTestId('continue').click();
  await expect(page.getByTestId('city-heading')).toBeVisible();
}

test('leave Charizard, fight: a level for a battle won, none for running away; take it back for ₽2000', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: indigo() });
  await expect(page.getByTestId('city-dojo')).toContainText('Leave a Pokémon to train');
  await page.getByTestId('city-dojo').click();
  await expect(page.getByTestId('dojo-message')).toContainText('It gains a level for every battle you fight in Kanto');

  // Choosing asks first: taking it back costs money.
  await page.getByTestId('dojo-pick-1').click();
  await expect(page.getByTestId('dojo-message')).toHaveText('Leave Charizard here to train? Taking it back will cost ₽2000.');
  await page.getByTestId('dojo-leave').click();
  await expect(page.getByTestId('dojo-message')).toContainText('Charizard is in good hands!');
  await expect(page.getByTestId('dojo-levels')).toHaveText('Lv. 60');
  // Back has the focus, not "Take back": pressing A / Enter once more can't spend ₽2000 by accident.
  await expect(page.getByTestId('back')).toBeFocused();
  expect(await save(page)).toMatchObject({ party: [{ speciesId: 150 }], dojo: { pokemon: { speciesId: 6, level: 60 }, battles: 0 } });

  // A battle won: one level. Running away: none.
  await page.getByTestId('back').click();
  await huntAndWin(page);
  expect((await save(page)).dojo).toMatchObject({ battles: 1 });
  await page.getByTestId('hunt-grass').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('city-heading')).toBeVisible();
  expect((await save(page)).dojo).toMatchObject({ battles: 1 });
  await expect(page.getByTestId('city-dojo')).toContainText('Charizard · Lv. 60 → 61');

  // Back, for the fee, into the party.
  await page.getByTestId('city-dojo').click();
  await expect(page.getByTestId('dojo-levels')).toContainText('Lv. 61');
  await page.getByTestId('dojo-take').click();
  await expect(page.getByTestId('dojo-message')).toHaveText('Charizard is back, at Lv. 61! It joined your party.');
  const after = await save(page);
  expect(after).toMatchObject({ money: 1000, dojo: null });
  expect(after.party.map(p => [p.speciesId, p.level])).toEqual([
    [150, 100],
    [6, 61],
  ]);
  // Nobody training: the party to choose from again.
  await expect(page.getByTestId('dojo-party')).toBeVisible();
});

test('without ₽2000, the master says so and nothing changes', async ({ page }) => {
  const charizard = (fixture('save-v7-indigo.json') as { party: unknown[] }).party[1];
  await openGame(page, { scene: 'city' }, { save: { ...indigo({ money: 500 }), version: 8, dojo: { pokemon: charizard, battles: 2 } } });
  await page.getByTestId('city-dojo').click();
  await page.getByTestId('dojo-take').click();
  await expect(page.getByTestId('dojo-message')).toHaveText('Taking Charizard back costs ₽2000, and you have ₽500.');
  expect(await save(page)).toMatchObject({ money: 500, dojo: { battles: 2 } });
});

test("the party's last Pokémon can't be left", async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: indigo({ party: [(fixture('save-v7-indigo.json') as { party: unknown[] }).party[0]] }) });
  await page.getByTestId('city-dojo').click();
  await page.getByTestId('dojo-pick-0').click();
  await expect(page.getByTestId('dojo-message')).toHaveText('Mewtwo is your only Pokémon: keep at least one with you.');
  expect((await save(page)).dojo).toBeNull();
});

test('only the League city has a dojo', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: indigo({ location: 'viridian' }) });
  await expect(page.getByTestId('city-heading')).toBeVisible();
  await expect(page.getByTestId('city-dojo')).toHaveCount(0);
});
