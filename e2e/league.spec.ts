// The Pokémon League, played for real: five battles in a row, the Hall of Fame, the credits, and the next region.

import { battle, expect, fixture, openGame, save, scene, step, test, winBattle } from './helpers';

const victoryRoad = () => fixture('save-v5-victory-road.json') as Record<string, unknown>;

test.describe('Pokémon League', () => {
  test('needs all 8 badges', async ({ page }) => {
    const data = victoryRoad();
    data.badges = (data.badges as string[]).slice(0, 7);
    await openGame(page, { scene: 'city' }, { save: data });
    await expect(page.getByTestId('city-league')).toContainText('8 badges');
    await expect(page.getByTestId('city-league')).toBeDisabled();
  });

  test('the Elite Four and the Champion, then the Hall of Fame, the credits and the next region', async ({ page }) => {
    test.setTimeout(180_000);
    await openGame(page, { scene: 'city' }, { save: victoryRoad() });
    await page.getByTestId('city-league').click();

    const opponents = ['Elite Four Lorelei (Ice)', 'Elite Four Bruno (Fighting)', 'Elite Four Agatha (Ghost)', 'Elite Four Lance (Dragon)', 'Champion Ren'];
    for (const [i, who] of opponents.entries()) {
      await expect(page.getByTestId('league-info-0')).toHaveText(`Battle ${i + 1} of 5`);
      await expect(page.getByTestId('league-info-1')).toHaveText(`Next: ${who}`);
      await page.getByTestId('league-next').click();
      await page.getByTestId('dialog-next').click();
      expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'league' });
      // No running away from the League.
      await page.keyboard.press('Escape');
      expect(await scene(page)).toMatchObject({ mode: 'league' });
      await winBattle(page);
      await expect(page.getByTestId('results').getByRole('heading')).toHaveText('Victory!');
      await page.getByTestId('continue').click();
      await page.getByTestId('dialog-next').click();
    }

    // The Professor, the Hall of Fame, the credits, the next region.
    await expect(page.getByTestId('dialog-text')).toContainText('You are the new Pokémon League Champion!');
    await page.getByTestId('dialog-next').click();
    await expect(page.getByTestId('hall-of-fame')).toContainText('Mewtwo');
    await page.getByTestId('hof-next').click();
    await expect(page.getByTestId('credits')).toContainText('Thanks for playing!');
    await page.getByTestId('credits-next').click();
    await expect(page.getByTestId('next-region-go')).toBeDisabled();
    await page.getByTestId('next-region-stay').click();

    await expect(page.getByTestId('city-champion')).toHaveText('Champion');
    const after = await save(page);
    expect(after.champion).toBe(true);
    expect(after.hallOfFame).toHaveLength(1);
    expect(after.hallOfFame[0].team.map(m => m.speciesId)).toEqual([150, 6]);
    // The League can be challenged again.
    await expect(page.getByTestId('city-league')).toBeEnabled();
  });

  test('between battles: the party screen (for potions) goes back to the League', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: victoryRoad() });
    await page.getByTestId('city-league').click();
    await page.getByTestId('league-party').click();
    await expect(page.getByTestId('party')).toBeVisible();
    await page.getByTestId('close-party').click();
    await expect(page.getByTestId('league')).toBeVisible();
    await page.getByTestId('league-leave').click();
    await expect(page.getByTestId('city-heading')).toHaveText('Indigo Plateau');
  });

  test('a loss ends the run: half the money, back to the city', async ({ page }) => {
    test.setTimeout(120_000);
    // The Lv. 30 team against Lorelei, a hard CPU, without fighting back.
    const data = fixture('save-v4-team.json') as Record<string, unknown>;
    Object.assign(data, { location: 'indigo', badges: (victoryRoad().badges as string[]).slice() });
    await openGame(page, { scene: 'city', opponent: 'cpu-hard' }, { save: data });
    await page.getByTestId('city-league').click();
    await page.getByTestId('league-next').click();
    await page.getByTestId('dialog-next').click();
    // Lorelei keeps her distance (a zoner): up to three full 99-second rounds. When a Pokémon faints, the player
    // picks the next one (J), as anyone would.
    for (let i = 0; i < 3 * 100 && !(await page.getByTestId('results').isVisible()); i++) {
      if ((await battle(page)).phase === 'choose') await page.keyboard.press('j');
      await step(page, 60);
    }
    await expect(page.getByTestId('results').getByRole('heading')).toHaveText('Defeat…');
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('city-heading')).toHaveText('Indigo Plateau');
    expect((await save(page)).money).toBe(1500);
  });
});
