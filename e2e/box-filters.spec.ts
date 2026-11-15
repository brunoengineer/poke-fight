// The PC box's favorites and filters (decided 2026-11-15): a star on a Pokémon (RB / F), a type filter that lists only
// the box's types, a favorites filter; hidden Pokémon keep their places.

import { expect, fixture, openGame, save, test } from './helpers';

type Mon = { speciesId: number; favorite?: boolean };
type Data = { party: Mon[]; box: Mon[] };

/** Pewter; Charmeleon in the party; the box: Kadabra, Machoke, Charmeleon, Kadabra. */
function boxSave() {
  const data = fixture('save-v4-team.json') as Data;
  const [charmeleon, kadabra, machoke] = data.party;
  return { ...data, party: [charmeleon], box: [kadabra, machoke, charmeleon, kadabra] };
}

test('filter by type (only the types in the box), mark a favorite, filter by favorites, clear', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: boxSave() });
  await page.getByTestId('city-box').click();
  await expect(page.locator('.box-grid .slot:not(.empty)')).toHaveCount(4);

  await page.getByTestId('box-filter-type').click();
  const picker = page.getByTestId('box-filter-type-picker');
  await expect(picker.locator('.dex-choice')).toHaveText(['All', 'Fighting · 1', 'Fire · 1', 'Psychic · 2']);
  await page.getByTestId('box-type-psychic').click();
  await expect(page.getByTestId('box-filter-type')).toContainText('Psychic');
  await expect(page.getByTestId('box-shown')).toHaveText('2 shown');
  // The focus is on the first one shown.
  await expect(page.getByTestId('box-slot-0')).toBeFocused();
  // Only the two Kadabra, still at their own places.
  await expect(page.locator('.box-grid .slot:not(.empty)')).toHaveCount(2);
  await expect(page.getByTestId('box-slot-0')).toBeVisible();
  await expect(page.getByTestId('box-slot-3')).toBeVisible();

  // F marks the focused one as a favorite: a star in its corner, kept in the save.
  await page.getByTestId('box-slot-3').focus();
  await page.keyboard.press('f');
  await expect(page.getByTestId('box-slot-3-fav')).toBeVisible();
  await expect(page.getByTestId('box-favorite')).toHaveAttribute('aria-pressed', 'true');
  expect((await save(page)).box.map(p => p.favorite === true)).toEqual([false, false, false, true]);

  // Favorites only: the type filter goes, the star stays.
  await page.getByTestId('box-filter-clear').click();
  await expect(page.locator('.box-grid .slot:not(.empty)')).toHaveCount(4);
  await page.getByTestId('box-filter-favorites').click();
  await expect(page.locator('.box-grid .slot:not(.empty)')).toHaveCount(1);
  await expect(page.getByTestId('box-slot-3')).toBeVisible();

  // Unmarked while only favorites show: nothing left, and the box says so.
  await page.getByTestId('box-slot-3').focus();
  await page.keyboard.press('f');
  await expect(page.getByTestId('box-no-match')).toHaveText('No Pokémon in the box match these filters.');
  expect((await save(page)).box.some(p => p.favorite)).toBe(false);
});

test('a favorite keeps its star when it moves to the party, and the filters start cleared next time', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: boxSave() });
  await page.getByTestId('city-box').click();
  await page.getByTestId('box-slot-1').focus();
  await page.getByTestId('box-favorite').click();
  await page.getByTestId('box-slot-1').focus();
  await page.keyboard.press('s');
  await expect(page.getByTestId('party-slot-1-fav')).toBeVisible();
  expect((await save(page)).party.map(p => [p.speciesId, p.favorite === true])).toEqual([
    [5, false],
    [67, true],
  ]);
  await page.getByTestId('box-filter-favorites').click();
  await page.getByTestId('back').click();
  await page.getByTestId('city-box').click();
  await expect(page.getByTestId('box-filter-favorites')).toHaveAttribute('aria-pressed', 'false');
});
