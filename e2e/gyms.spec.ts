// Gyms, the Safari Zone and evolution items, played for real.

import { expect, fixture, openGame, save, scene, snapshot, step, test, winBattle } from './helpers';

type SaveData = { location: string; money: number; badges: string[]; bag: Record<string, number>; party: { speciesId: number }[] };
const team = (change: Partial<SaveData> = {}) => ({ ...(fixture('save-v4-team.json') as SaveData), ...change });

test.describe('gyms', () => {
  test('Brock: his words, his team, the Boulder Badge, prize money, and Cerulean opens', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team() });
    await expect(page.getByTestId('city-gym')).toHaveText('Gym: Brock (Rock)');
    await page.getByTestId('city-gym').click();
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

    await expect(page.getByTestId('city-gym')).toHaveText('Gym: Boulder Badge ✓');
    await expect(page.getByTestId('city-gym')).toBeDisabled();
    await expect(page.getByTestId('city-info-2')).toHaveText('Badges: 1/8');
    const after = await save(page);
    expect(after.badges).toEqual(['boulder']);
    expect(after.money).toBe(3000 + 1386);
    await page.getByTestId('city-map').click();
    await expect(page.getByTestId('go-cerulean')).toBeEnabled();
  });

  test("Viridian's gym is locked until the 7th badge", async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team({ location: 'viridian' }) });
    await expect(page.getByTestId('city-gym')).toHaveText('Gym (needs 7 badges)');
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
    await expect(page.getByTestId('throw-safari-ball')).toHaveText('Safari Ball (×30)');
    await page.getByTestId('throw-safari-ball').click();
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
    // Kadabra (2nd) can use the cable; nobody here can use the Thunder Stone.
    await expect(page.getByTestId('evolve-thunder-stone-1')).toHaveCount(0);
    await page.getByTestId('evolve-link-cable-1').click();
    await expect(page.getByTestId('member-1')).toContainText('Alakazam');
    const after = await save(page);
    expect(after.party[1].speciesId).toBe(65);
    expect(after.bag['link-cable']).toBeUndefined();
    expect(after.bag['thunder-stone']).toBe(1);
  });

  test('stones and the Link Cable are sold at the Saffron mall', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team({ location: 'saffron', badges: ['boulder', 'cascade', 'thunder', 'rainbow', 'soul'], money: 5000 }) });
    await page.getByTestId('city-shop').click();
    await page.getByTestId('buy-moon-stone').click();
    await page.getByTestId('buy-link-cable').click();
    expect((await save(page)).bag).toMatchObject({ 'moon-stone': 1, 'link-cable': 1 });
    expect((await save(page)).money).toBe(5000 - 2 * 2100);
  });
});

test.describe('journey fights are fair', () => {
  test('the training tools (F2 opponent, F3 infinite PP) do nothing in a gym', async ({ page }) => {
    await openGame(page, { scene: 'city', opponent: 'cpu-hard' }, { save: team() });
    await page.getByTestId('city-gym').click();
    await page.getByTestId('dialog-next').click();
    await page.keyboard.press('F2');
    await page.keyboard.press('F3');
    await page.keyboard.press('k');
    await step(page, 1);
    // F3 would have kept PP at 100: a special still costs its 25.
    expect((await snapshot(page)).fighters[0].pp).toBe(25);
    expect((await page.evaluate(() => window.__pf!.debug())).opponent).toBe('cpu-hard');
  });
});
