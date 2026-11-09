// The bag: from the city's bottom bar (or RB / B), items by pocket; potions and evolution items are used on a party
// Pokémon from here.

import { expect, fixture, openGame, save, test } from './helpers';

type SaveData = { bag: Record<string, number>; party: { speciesId: number; hp: number }[] };
const team = (bag: Record<string, number>, hurt = true) => {
  const data = fixture('save-v4-team.json') as SaveData;
  data.bag = bag;
  // Charmeleon has taken a beating.
  if (hurt) data.party[0].hp = 100;
  return data;
};

test('a potion heals the Pokémon you pick, and is used up', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: team({ potion: 2, 'poke-ball': 5, 'old-rod': 1 }) });
  await page.getByTestId('city-bag').click();
  await expect(page.getByTestId('pocket-medicine')).toContainText('Potion');
  await expect(page.getByTestId('bag-potion')).toContainText('×2');
  // A on the potion: straight to the first Pokémon it helps (the others are at full HP).
  await page.getByTestId('bag-potion').click();
  await expect(page.getByTestId('use-potion-0')).toBeFocused();
  await expect(page.getByTestId('use-potion-0')).toContainText('+20 HP');
  await expect(page.getByTestId('use-potion-1')).toContainText('Full HP');
  await expect(page.getByTestId('use-potion-1')).toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('toast')).toHaveText('Charmeleon recovered 20 HP!');
  const after = await save(page);
  expect(after.party[0].hp).toBe(100 + 20 * 10);
  expect(after.bag.potion).toBe(1);
  // Still on the same Pokémon, ready for another.
  await expect(page.getByTestId('use-potion-0')).toBeFocused();
  await expect(page.getByTestId('bag-potion')).toContainText('×1');
});

test('the Link Cable evolves Kadabra from the bag (the evolution plays), then back to the bag', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: team({ 'link-cable': 1 }) });
  await page.keyboard.press('b');
  await expect(page.getByTestId('bag')).toBeVisible();
  await page.getByTestId('bag-link-cable').click();
  await expect(page.getByTestId('use-link-cable-0')).toContainText('No effect');
  await expect(page.getByTestId('use-link-cable-1')).toBeFocused();
  await expect(page.getByTestId('use-link-cable-1')).toContainText('Can evolve!');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('evolution-text')).toHaveText('Congratulations! Kadabra evolved into Alakazam!');
  await page.getByTestId('evolution-done').click();
  await expect(page.getByTestId('bag-empty')).toBeVisible();
  expect((await save(page)).party[1].speciesId).toBe(65);
});

test('balls and rods are used elsewhere: the bag says where', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: team({ 'poke-ball': 5, 'old-rod': 1 }, false) });
  await page.getByTestId('city-bag').click();
  await page.getByTestId('bag-poke-ball').focus();
  await expect(page.getByTestId('bag-detail')).toContainText('Thrown after you beat a wild Pokémon.');
  await page.getByTestId('bag-old-rod').focus();
  await expect(page.getByTestId('bag-detail')).toContainText('Used when you go fishing');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('city')).toBeVisible();
});

test('an empty bag says so', async ({ page }) => {
  const data = team({}, false) as SaveData & { bag: Record<string, number> };
  await openGame(page, { scene: 'city' }, { save: data });
  await page.getByTestId('city-bag').click();
  await expect(page.getByTestId('bag-empty')).toContainText('Your bag is empty');
});
