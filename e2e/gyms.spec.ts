// Gyms, the Safari Zone and evolution items, played for real.

import { expect, fixture, openGame, save, scene, snapshot, step, test, winBattle } from './helpers';

type SaveData = { location: string; money: number; badges: string[]; bag: Record<string, number>; party: { speciesId: number }[] };
const team = (change: Partial<SaveData> = {}) => ({ ...(fixture('save-v4-team.json') as SaveData), ...change });

test.describe('gyms', () => {
  test('Pewter Gym: two trainers in a row (HP carries over), then Brock, the Boulder Badge, and Cerulean opens', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team() });
    await expect(page.getByTestId('city-gym')).toContainText('Brock · Rock');
    await page.getByTestId('city-gym').click();
    // The hall: two gym trainers, then the leader.
    await expect(page.getByTestId('gym-hall')).toContainText('Pewter City Gym');
    await expect(page.getByTestId('gym-hall')).toContainText('Battle 1 of 3');
    await expect(page.locator('.seat')).toHaveCount(3);
    await expect(page.locator('.seat.next')).toContainText('Hiker');
    await page.getByTestId('gym-next').click();
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'gym' });
    expect((await snapshot(page)).fighters[1].level).toBe(8);
    await winBattle(page);
    // Two Lv. 8 Pokémon: (8 + 8) × 12.
    await expect(page.getByTestId('results-lines')).toContainText('You got ₽192 for winning!');
    const hurt = (await save(page)).party.map(p => (p as unknown as { hp: number }).hp);
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('gym-hall')).toContainText('Battle 2 of 3');
    await expect(page.locator('.seat.beaten')).toHaveCount(1);
    // No healing in between: the party is as the battle left it.
    expect((await save(page)).party.map(p => (p as unknown as { hp: number }).hp)).toEqual(hurt);
    await page.getByTestId('gym-next').click();
    expect((await snapshot(page)).fighters[1].level).toBe(10);
    await winBattle(page);
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('gym-hall')).toContainText('Battle 3 of 3');
    await page.getByTestId('gym-next').click();
    await expect(page.getByTestId('dialog')).toContainText('Brock');
    await page.getByTestId('dialog-next').click();

    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'gym' });
    expect((await snapshot(page)).fighters[1]).toMatchObject({ name: 'Geodude', level: 12 });
    await winBattle(page);
    await expect(page.getByTestId('results-lines')).toContainText('You got ₽1386 for winning!');
    await expect(page.getByTestId('results-lines')).toContainText('You earned the Boulder Badge!');
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('dialog-text')).toContainText('Take the Boulder Badge!');
    await page.getByTestId('dialog-next').click();

    await expect(page.getByTestId('city-gym')).toContainText('Beaten');
    await expect(page.getByTestId('city-gym')).toBeDisabled();
    await expect(page.getByTestId('city-badges')).toHaveText('1/8');
    const after = await save(page);
    expect(after.badges).toEqual(['boulder']);
    expect(after.money).toBe(3000 + 192 + 240 + 1386);
    await page.getByTestId('city-map').click();
    await expect(page.getByTestId('go-cerulean')).toBeEnabled();
  });

  test("Viridian's gym is locked until the 7th badge", async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team({ location: 'viridian' }) });
    await expect(page.getByTestId('city-gym')).toContainText('7 badges');
    await expect(page.getByTestId('city-gym')).toBeDisabled();
  });
});

test.describe('Safari Zone', () => {
  const fuchsia = () => team({ location: 'fuchsia', badges: ['boulder', 'cascade', 'thunder', 'rainbow'] });

  test('pay to enter, beat a Pokémon, throw a Safari Ball; the balls are not in the bag', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fuchsia() });
    await page.getByTestId('city-safari').click();
    await expect(page.getByTestId('safari-info-0')).toHaveText('Safari Balls: 30');
    expect((await save(page)).money).toBe(2500);

    await page.getByTestId('safari-search').click();
    expect(await scene(page)).toMatchObject({ mode: 'safari' });
    await winBattle(page);
    await expect(page.getByTestId('throw-safari-ball')).toHaveText('Safari Ball ×30');
    await page.getByTestId('throw-safari-ball').click();
    await page.getByTestId('capture-done').click();
    await expect(page.getByTestId('results-lines')).toContainText(/caught|fled/);
    await page.getByTestId('continue').click();

    await expect(page.getByTestId('safari-info-0')).toHaveText('Safari Balls: 29');
    expect((await save(page)).bag['safari-ball']).toBeUndefined();
    await page.getByTestId('safari-leave').click();
    await expect(page.getByTestId('city-heading')).toHaveText('Fuchsia City');
  });

  test('a Pokémon not knocked out within 30 seconds flees', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fuchsia() });
    await page.getByTestId('city-safari').click();
    await page.getByTestId('safari-search').click();
    // Nobody attacks (the dummy stands): the clock runs out.
    for (let i = 0; i < 40 && !(await page.getByTestId('results').isVisible()); i++) await step(page, 60);
    await expect(page.getByTestId('results-lines')).toContainText('fled!');
    await expect(page.getByTestId('results-prompt')).toHaveCount(0);
  });
});

test.describe('evolution items', () => {
  test('the Link Cable evolves Kadabra into Alakazam from the party screen', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team({ bag: { 'poke-ball': 5, 'link-cable': 1, 'thunder-stone': 1 } }) });
    await page.keyboard.press('p');
    // The summary follows the focus: Kadabra (2nd) can use the cable; nobody here can use the Thunder Stone.
    await page.getByTestId('member-1').focus();
    await expect(page.getByTestId('evolve-thunder-stone-1')).toHaveCount(0);
    await page.getByTestId('evolve-link-cable-1').click();
    await expect(page.getByTestId('evolution-text')).toContainText('evolved into Alakazam');
    await page.getByTestId('evolution-done').click();
    await expect(page.getByTestId('member-1')).toContainText('Alakazam');
    const after = await save(page);
    expect(after.party[1].speciesId).toBe(65);
    expect(after.bag['link-cable']).toBeUndefined();
    expect(after.bag['thunder-stone']).toBe(1);
  });

  test('stones and the Link Cable are sold at the Saffron mall', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team({ location: 'saffron', badges: ['boulder', 'cascade', 'thunder', 'rainbow', 'soul'], money: 12000 }) });
    await page.getByTestId('city-shop').click();
    await page.getByTestId('buy-moon-stone').click();
    await page.getByTestId('buy-link-cable').click();
    expect((await save(page)).bag).toMatchObject({ 'moon-stone': 1, 'link-cable': 1 });
    // Every evolution item costs 5000 (plan.md §5, Economy).
    expect((await save(page)).money).toBe(12000 - 2 * 5000);
  });
});

test.describe('gym runs', () => {
  test('from the hall: the party (potions between battles), and leaving ends the run', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team({ bag: { potion: 1 } }) });
    await page.getByTestId('city-gym').click();
    await page.getByTestId('gym-party').click();
    await expect(page.getByTestId('party')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('gym-hall')).toBeVisible();
    await page.getByTestId('gym-leave').click();
    await expect(page.getByTestId('city')).toBeVisible();
    // Back in: the run starts over, from the first trainer.
    await page.getByTestId('city-gym').click();
    await expect(page.getByTestId('gym-hall')).toContainText('Battle 1 of 3');
  });
});

test.describe('journey fights are fair', () => {
  test('the training tools (F2 opponent, F3 infinite PP) do nothing in a gym', async ({ page }) => {
    await openGame(page, { scene: 'city', opponent: 'cpu-hard' }, { save: team() });
    await page.getByTestId('city-gym').click();
    await page.getByTestId('gym-next').click();
    await page.keyboard.press('F2');
    await page.keyboard.press('F3');
    await page.keyboard.press('k');
    await step(page, 1);
    // F3 would have kept PP at 100: a special still costs its 25.
    expect((await snapshot(page)).fighters[0].pp).toBe(25);
    expect((await page.evaluate(() => window.__pf!.debug())).opponent).toBe('cpu-hard');
  });
});
