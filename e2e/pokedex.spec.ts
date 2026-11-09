// The Pokédex (from the city's chip, or X), releasing a Pokémon from the box, and the wild fight's Poké Ball that says
// whether you already have that species.

import { expect, fixture, openGame, save, step, test, winBattle } from './helpers';

const team = () => fixture('save-v4-team.json') as { dex: { seen: number[]; caught: number[] }; party: { speciesId: number }[]; box: unknown[] };

test.describe('the Pokédex', () => {
  test('opens from the city; pages grow with what you know (unseen, seen, caught)', async ({ page }) => {
    const data = team();
    data.dex = { seen: [5, 64, 67, 63, 74], caught: [5, 64, 67, 63] };
    await openGame(page, { scene: 'city' }, { save: data });
    await expect(page.getByTestId('city-dex')).toHaveText('5 seen · 4 caught');
    await page.getByTestId('city-dex').click();
    await expect(page.getByTestId('dex-counts')).toHaveText('5 seen · 4 caught · 151');
    await expect(page.locator('.dex-tile')).toHaveCount(151);

    // Caught and with you: everything, with its family (Abra → Kadabra at Lv. 16 → Alakazam with the Link Cable).
    await page.getByTestId('dex-64').focus();
    await expect(page.getByTestId('dex-name')).toHaveText('Kadabra');
    await expect(page.getByTestId('dex-status')).toHaveText('Caught · you have 1');
    await expect(page.getByTestId('dex-entry')).toContainText('Height 1.3 m · Weight 56.5 kg');
    await expect(page.getByTestId('dex-chain')).toContainText('Lv. 16');
    await expect(page.getByTestId('dex-chain')).toContainText('Link Cable');
    // Alakazam hasn't been seen: its name stays hidden.
    await expect(page.getByTestId('dex-chain')).toContainText('???');

    // Caught once, none with you now.
    await page.getByTestId('dex-63').focus();
    await expect(page.getByTestId('dex-status')).toHaveText('Caught before · none with you now');

    // Seen only: name and where it lives, no entry.
    await page.getByTestId('dex-74').focus();
    await expect(page.getByTestId('dex-name')).toHaveText('Geodude');
    await expect(page.getByTestId('dex-status')).toHaveText('Seen');
    await expect(page.getByTestId('dex-where')).toContainText('Pewter City · Cave');
    await expect(page.getByTestId('dex-entry')).toHaveCount(0);

    // Never seen: only the number.
    await page.getByTestId('dex-150').focus();
    await expect(page.getByTestId('dex-name')).toHaveText('???');
    await expect(page.getByTestId('dex-status')).toHaveText('Not seen yet');

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city')).toBeVisible();
  });

  test('X opens it from the city, too', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team() });
    await page.keyboard.press('x');
    await expect(page.getByTestId('pokedex')).toBeVisible();
  });
});

test.describe('releasing', () => {
  test('from the box, after asking ("Keep it" is the safe default); the Pokédex still counts it as caught', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: team() });
    const dexBefore = (await save(page)).dex;
    await page.getByTestId('city-box').click();
    await page.getByTestId('to-box-1').focus();
    await page.getByTestId('release').click();
    await expect(page.getByTestId('release-sheet')).toContainText('Release Kadabra (Lv. 30)?');
    await expect(page.getByTestId('release-no')).toBeFocused();
    // Esc keeps it.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('release-sheet')).toHaveCount(0);
    await expect(page.getByTestId('box')).toBeVisible();
    expect((await save(page)).party).toHaveLength(3);

    await page.getByTestId('to-box-1').focus();
    await page.keyboard.press('Delete');
    await page.getByTestId('release-yes').click();
    await expect(page.getByTestId('toast')).toHaveText('Bye-bye, Kadabra!');
    const after = await save(page);
    expect(after.party.map(p => p.speciesId)).toEqual([5, 67]);
    expect(after.dex).toEqual(dexBefore);
  });

  test("the party's last Pokémon can't be released", async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fixture('save-v3-pallet-starter.json') });
    await page.getByTestId('city-box').click();
    await page.getByTestId('to-box-0').focus();
    await expect(page.getByTestId('release')).toHaveCount(0);
    await expect(page.locator('.box-detail')).toContainText('Your party needs at least one Pokémon');
  });
});

test.describe("the wild fight's Poké Ball", () => {
  const owned = (page: import('@playwright/test').Page) => page.evaluate(() => window.__pf!.debug().owned);

  test('grey for a species you don\'t have; in color once you have one', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: { ...(fixture('save-v3-pallet-starter.json') as object), bag: { 'master-ball': 1 } } });
    await page.getByTestId('hunt-grass').click();
    await step(page, 1);
    expect(await owned(page)).toBe(false);
    const wild = (await page.evaluate(() => window.__pf!.snapshot())).fighters[1].speciesId;
    await winBattle(page);
    await page.getByTestId('throw-master-ball').click();
    await page.getByTestId('capture-done').click();
    // Hunt again until the same species shows up: now the ball is in color.
    for (let i = 0; i < 10; i++) {
      await page.getByTestId('hunt-again').click();
      await step(page, 1);
      const now = (await page.evaluate(() => window.__pf!.snapshot())).fighters[1].speciesId;
      if (now === wild) {
        expect(await owned(page)).toBe(true);
        break;
      }
      expect(await owned(page)).toBe(false);
      await winBattle(page);
      // No balls left: there is nothing to throw, the results go straight to Hunt again.
      await expect(page.getByTestId('hunt-again')).toBeVisible();
    }
  });

  test("not shown against a trainer's Pokémon (it can't be caught)", async ({ page }) => {
    await openGame(page, { scene: 'training' }, { save: fixture('save-v4-team.json') });
    await step(page, 1);
    expect(await owned(page)).toBeNull();
  });
});
