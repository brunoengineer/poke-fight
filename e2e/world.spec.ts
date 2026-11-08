// The world loop, played for real: the city, hunting and catching, the shop and the rod, the Pokémon Center, the box,
// the world map, potions, and what losing costs.

import { expect, fixture, openGame, save, scene, snapshot, step, test, winBattle } from './helpers';

type SaveData = { money: number; bag: Record<string, number>; party: { speciesId: number; hp: number }[]; location: string };
const start = () => fixture('save-v3-pallet-starter.json') as SaveData;

test.describe('the city', () => {
  test('shows money and the Pokédex; Pallet Town has grass and water but no shop', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await expect(page.getByTestId('city-heading')).toHaveText('Pallet Town');
    await expect(page.getByTestId('city-info-0')).toHaveText('Money: ₽3000');
    await expect(page.getByTestId('city-info-1')).toHaveText('Pokédex: 2 seen · 1 caught');
    await expect(page.getByTestId('hunt-grass')).toBeEnabled();
    await expect(page.getByTestId('hunt-water')).toBeDisabled();
    await expect(page.getByTestId('hunt-water')).toHaveText('Fish (you need a fishing rod)');
    await expect(page.getByTestId('city-shop')).toHaveCount(0);
  });

  test('the world map: Viridian and Pewter are open, the rest needs badges', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('city-map').click();
    await expect(page.getByTestId('place-pallet')).toContainText('You are here');
    await expect(page.getByTestId('go-cerulean')).toBeDisabled();
    await expect(page.getByTestId('place-cerulean')).toContainText('Needs 1 badge(s)');
    await page.getByTestId('go-viridian').click();
    await expect(page.getByTestId('city-heading')).toHaveText('Viridian City');
    expect((await save(page)).location).toBe('viridian');
  });
});

test.describe('hunting and catching', () => {
  test('a wild Pokémon in the grass: beat it, throw a Poké Ball, and it joins the party', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'wild' });
    const wild = (await snapshot(page)).fighters[1].name;
    expect(['Pidgey', 'Rattata']).toContain(wild);

    await winBattle(page);
    await expect(page.getByTestId('results-prompt')).toHaveText(`The wild ${wild} is worn out! Throw a ball?`);
    // Route 1's Pokémon have a catch rate of 255: a Poké Ball always works.
    await page.getByTestId('throw-poke-ball').click();
    await expect(page.getByTestId('results-lines')).toContainText(`Gotcha! ${wild} was caught!`);
    await page.getByTestId('continue').click();

    const after = await save(page);
    expect(after.party).toHaveLength(2);
    expect(after.bag['poke-ball']).toBe(4);
    expect(after.dex.caught).toContain(after.party[1].speciesId);
    await expect(page.getByTestId('city-info-1')).toContainText('2 caught');
  });

  test('a defeated wild Pokémon can be let go', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    await winBattle(page);
    await page.getByTestId('let-go').click();
    await expect(page.getByTestId('results-lines')).toContainText('You let the wild');
    await page.getByTestId('continue').click();
    expect((await save(page)).party).toHaveLength(1);
  });

  test('Esc runs away from a wild Pokémon', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city-heading')).toHaveText('Pallet Town');
  });

  test('losing costs half the money; the party is healed and back in the city', async ({ page }) => {
    // The wild Pokémon is a hard CPU, and the player does nothing.
    await openGame(page, { scene: 'city', opponent: 'cpu-hard' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    for (let i = 0; i < 120 && !(await page.getByTestId('results').isVisible()); i++) await step(page, 60);
    await expect(page.getByTestId('results').getByRole('heading')).toHaveText('Defeat…');
    await expect(page.getByTestId('results-lines')).toContainText('lost ₽1500');
    await page.getByTestId('continue').click();
    const after = await save(page);
    expect(after.money).toBe(1500);
    expect(after.party[0].hp).toBeGreaterThan(0);
  });
});

test.describe('the shop and fishing', () => {
  test('buying Poké Balls and the Old Rod in Viridian; then fishing gives a Magikarp', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: { ...start(), location: 'viridian' } });
    await page.getByTestId('city-shop').click();
    await page.getByTestId('buy-poke-ball').click();
    await expect(page.getByTestId('item-poke-ball')).toContainText('You have 6');
    await expect(page.getByTestId('shop-info-0')).toHaveText('Money: ₽2800');
    await page.getByTestId('buy-old-rod').click();
    await expect(page.getByTestId('buy-old-rod')).toBeDisabled();
    await expect(page.getByTestId('buy-old-rod')).toHaveText('Already yours');
    expect((await save(page)).money).toBe(1800);

    await page.getByTestId('back').click();
    await expect(page.getByTestId('hunt-water')).toHaveText('Fish (Old Rod)');
    await page.getByTestId('hunt-water').click();
    // Viridian's Old Rod table only has Magikarp (as in Red/Blue).
    expect((await snapshot(page)).fighters[1].name).toBe('Magikarp');
  });

  test('not enough money: nothing is bought', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: { ...start(), location: 'viridian', money: 100 } });
    await page.getByTestId('city-shop').click();
    await page.getByTestId('buy-poke-ball').click();
    await expect(page.getByTestId('shop')).toContainText('You don’t have enough money.');
    expect((await save(page)).bag['poke-ball']).toBe(5);
  });
});

test.describe('the Pokémon Center, the box and potions', () => {
  test('the box: any city, Pokémon go back and forth; the party keeps at least one', async ({ page }) => {
    const data = fixture('save-v2-viridian.json');
    await openGame(page, { scene: 'city' }, { save: data });
    await page.getByTestId('city-box').click();
    await page.getByTestId('to-box-2').click();
    await page.getByTestId('to-box-1').click();
    await expect(page.getByTestId('to-box-0')).toBeDisabled();
    expect((await save(page)).party).toHaveLength(1);
    await page.getByTestId('to-party-0').click();
    const after = await save(page);
    expect(after.party).toHaveLength(2);
    expect(after.box).toHaveLength(1);
  });

  test('a potion from the party screen heals, and is used up', async ({ page }) => {
    const data = start();
    data.party[0].hp = 50;
    data.bag = { 'poke-ball': 5, potion: 1 };
    await openGame(page, { scene: 'city' }, { save: data });
    await page.keyboard.press('p');
    await page.getByTestId('use-potion-0').click();
    const after = await save(page);
    expect(after.party[0].hp).toBeGreaterThan(50);
    expect(after.bag.potion).toBeUndefined();
    await expect(page.getByTestId('use-potion-0')).toHaveCount(0);
  });
});

test.describe('the battle field', () => {
  test('beating the trainers pays prize money', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('city-training').click();
    expect(await scene(page)).toMatchObject({ mode: 'trainer' });
    await winBattle(page);
    // Three Lv. 5 Pokémon: (5 + 5 + 5) × 20.
    await expect(page.getByTestId('results-lines')).toContainText('You got ₽300 for winning!');
    await page.getByTestId('continue').click();
    expect((await save(page)).money).toBe(3300);
  });
});
