// Every region's Pokédex can be completed there (decided 2026-11-17): the League city hosts the earlier regions'
// Pokémon as visitors, and the Legends' Sanctuary the earlier regions' legendaries. Kanto's own leftovers (Mr. Mime…)
// are in Kanto's Hidden Grove. The saves are a Johto journey built by hand from a Kanto one.

import { battle, expect, fixture, openGame, save, scene, test } from './helpers';

type Data = Record<string, unknown> & { dex: { seen: number[]; caught: number[] } };
const JOHTO_BADGES = ['zephyr', 'hive', 'plain', 'fog', 'storm', 'mineral', 'glacier', 'rising'];

/** A Johto journey at its League city (or its sanctuary), all badges, Champion; Mewtwo Lv. 100 in the party. */
function johto(location = 'johto-league', dex = { seen: [150], caught: [150] }): Data {
  const kanto = fixture('save-v8-dojo.json') as Data;
  return { ...kanto, region: 'johto', location, badges: JOHTO_BADGES, champion: true, champions: ['kanto', 'johto'], dex, bag: { 'master-ball': 3, 'poke-ball': 5 }, dojo: null };
}

test("Johto's League city: Kanto visitors, none caught yet; a hunt there meets one of them at Lv. 30–46", async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: johto() });
  const card = page.getByTestId('hunt-visitors-kanto');
  await expect(card).toContainText('Kanto visitors');
  await expect(card.locator('.chip')).toHaveText('0/19');
  await card.click();
  expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'wild' });
  const wild = (await battle(page)).teams[1][0];
  expect(wild.level).toBeGreaterThanOrEqual(30);
  expect(wild.level).toBeLessThanOrEqual(46);
  // A Kanto Pokémon, now seen in Johto's Pokédex.
  const seen = (await save(page)).dex.seen.filter(id => id !== 150);
  expect(seen).toHaveLength(1);
  expect(seen[0]).toBeLessThanOrEqual(151);
});

test("Johto's sanctuary: the Legends of Kanto open their own row; one can be fought there", async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: johto('johto-sanctuary') });
  const group = page.getByTestId('legends-kanto');
  await expect(group).toContainText('Legends of Kanto');
  // Mewtwo is already caught in this journey (the save's dex).
  await expect(group.locator('.chip')).toHaveText('1/5');
  await group.click();
  await expect(page.getByTestId('legends')).toBeVisible();
  await expect(page.getByTestId('legends-heading')).toHaveText('Legends of Kanto');
  await expect(page.locator('[data-testid^="legend-"]')).toHaveCount(5);
  await expect(page.getByTestId('legend-mewtwo')).toHaveAttribute('aria-disabled', 'true');
  // Back to the sanctuary, and in again.
  await page.getByTestId('back').click();
  await expect(page.getByTestId('city-heading')).toBeVisible();
  await page.getByTestId('legends-kanto').click();
  await page.getByTestId('legend-articuno').click();
  expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'legendary' });
  expect((await battle(page)).teams[1][0]).toMatchObject({ name: 'Articuno', level: 55 });
});

test("the Pokédex says where a visitor lives: Bulbasaur, in Johto's League city", async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: johto('johto-league', { seen: [150, 1], caught: [150] }) });
  await page.getByTestId('city-dex').click();
  await page.getByTestId('dex-1').click();
  await expect(page.getByTestId('dex-where')).toContainText('Johto League · Kanto visitors · Lv. 30–36');
});

test("Mr. Mime lives in Kanto's Hidden Grove (it was only an in-game trade in Red/Blue)", async ({ page }) => {
  const kanto = fixture('save-v8-dojo.json') as Data;
  await openGame(page, { scene: 'city' }, { save: { ...kanto, dex: { seen: [...kanto.dex.seen, 122], caught: kanto.dex.caught } } });
  await expect(page.getByTestId('hunt-rare').locator('.chip')).toHaveText('0/18');
  await page.getByTestId('city-dex').click();
  await page.getByTestId('dex-122').click();
  await expect(page.getByTestId('dex-where')).toContainText('Indigo Plateau · Hidden Grove · Lv. 30–36');
});
