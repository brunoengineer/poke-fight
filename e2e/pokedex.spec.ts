// The Pokédex (from the city's chip, or X), releasing a Pokémon from the box, and the wild fight's Poké Ball that says
// whether you already have that species.

import { expect, fixture, openGame, save, step, test, winBattle } from './helpers';

const team = () => fixture('save-v4-team.json') as { dex: { seen: number[]; caught: number[] }; party: { speciesId: number }[]; box: unknown[] };

test.describe('the Pokédex', () => {
  const opened = async (page: import('@playwright/test').Page, language?: 'pt') => {
    const data = team() as ReturnType<typeof team> & { settings: { language: string } };
    data.dex = { seen: [5, 64, 67, 63, 74, 144, 16], caught: [5, 64, 67, 63, 16] };
    if (language) data.settings = { ...data.settings, language };
    await openGame(page, { scene: 'city' }, { save: data });
    await page.getByTestId('city-dex').click();
  };

  test('the list, then a page per species that grows with what you know (unseen, seen, caught)', async ({ page }) => {
    await opened(page);
    await expect(page.getByTestId('dex-counts')).toHaveText('7 seen · 5 caught · 151');
    await expect(page.locator('.dex-tile')).toHaveCount(151);
    await expect(page.getByTestId('dex-150')).toHaveAccessibleName('#150 ???');

    // Caught and with you: everything, with its family (Abra → Kadabra at Lv. 16 → Alakazam with the Link Cable).
    await page.getByTestId('dex-64').click();
    await expect(page.getByTestId('dex-name')).toHaveText('Kadabra');
    await expect(page.getByTestId('dex-genus')).toHaveText('Psi Pokémon');
    await expect(page.getByTestId('dex-status')).toHaveText('Caught · you have 1');
    await expect(page.getByTestId('dex-size')).toHaveText('Height 1.3 m · Weight 56.5 kg');
    await expect(page.getByTestId('dex-entry')).toContainText('alpha waves');
    await expect(page.getByTestId('dex-chain')).toContainText('Lv. 16');
    await expect(page.getByTestId('dex-chain')).toContainText('Link Cable');
    // Alakazam hasn't been seen: its name stays hidden.
    await expect(page.getByTestId('dex-chain')).toContainText('???');

    // RB: the next one in the list (Alakazam, never seen: only its number).
    await page.keyboard.press('e');
    await expect(page.getByTestId('dex-entry-heading')).toHaveText('#065 ???');
    await expect(page.getByTestId('dex-status')).toHaveText('Not seen yet');
    await expect(page.getByTestId('dex-entry')).toHaveCount(0);

    // B: back to the list, on the one we were looking at.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dex-65')).toBeFocused();

    // Seen only: name and where it lives, no entry.
    await page.getByTestId('dex-74').click();
    await expect(page.getByTestId('dex-name')).toHaveText('Geodude');
    await expect(page.getByTestId('dex-status')).toHaveText('Seen');
    await expect(page.getByTestId('dex-where')).toContainText('Pewter City · Cave');
    await expect(page.getByTestId('dex-entry')).toHaveCount(0);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city')).toBeVisible();
  });

  test('a long page scrolls with the d-pad (the arrows), a step at a time', async ({ page }) => {
    await opened(page);
    // Pidgey lives almost everywhere: a long page. (The layout scales with the screen, so a shorter box stands in
    // for a page longer than the screen.)
    await page.addStyleTag({ content: '.dex-body { max-height: 30cqh; }' });
    await page.getByTestId('dex-16').click();
    const body = page.getByTestId('dex-body');
    await expect(body).toBeFocused();
    const scrollTop = () => body.evaluate(element => element.scrollTop);
    expect(await scrollTop()).toBe(0);
    await page.keyboard.press('ArrowDown');
    await expect.poll(scrollTop).toBeGreaterThan(0);
    // The text keeps the focus while there is more to scroll; at the end, the focus moves on.
    await expect(body).toBeFocused();
    for (let i = 0; i < 20 && (await body.evaluate(element => element === document.activeElement)); i++) await page.keyboard.press('ArrowDown');
    expect(await body.evaluate(element => Math.ceil(element.scrollTop + element.clientHeight) >= element.scrollHeight)).toBe(true);
  });

  test('filters: owned, type, legendary, mythical, number; they add up and can be cleared', async ({ page }) => {
    await opened(page);
    // Owned: caught at some point (Abra counts, though it was released).
    await page.getByTestId('filter-owned').click();
    await expect(page.getByTestId('dex-shown')).toHaveText('5 shown');
    await expect(page.getByTestId('filter-owned')).toBeFocused();

    await page.getByTestId('filter-type').click();
    await expect(page.getByTestId('filter-type-picker')).toBeVisible();
    await page.getByTestId('type-psychic').click();
    await expect(page.getByTestId('filter-type')).toContainText('Psychic');
    await expect(page.locator('.dex-tile')).toHaveCount(2);
    await expect(page.getByTestId('dex-63')).toBeVisible();
    await expect(page.getByTestId('dex-64')).toBeVisible();

    await page.getByTestId('filter-clear').click();
    await expect(page.getByTestId('dex-shown')).toHaveText('151 shown');

    await page.getByTestId('filter-legendary').click();
    await expect(page.getByTestId('dex-shown')).toHaveText('4 shown');
    await page.getByTestId('filter-mythical').click();
    await expect(page.getByTestId('dex-shown')).toHaveText('5 shown');
    await page.getByTestId('filter-clear').click();

    await page.getByTestId('filter-range').click();
    await page.getByTestId('range-4').click();
    await expect(page.getByTestId('filter-range')).toContainText('#121–#151');
    await expect(page.locator('.dex-tile')).toHaveCount(31);
    await expect(page.getByTestId('dex-121')).toBeFocused();

    // Nothing matches: a message instead of the grid.
    await page.getByTestId('filter-owned').click();
    await expect(page.getByTestId('dex-empty')).toHaveText('No Pokémon match these filters.');

    // Within a filtered list, RB / LB walk through the list as filtered.
    await page.getByTestId('filter-clear').click();
    await page.getByTestId('filter-owned').click();
    await page.getByTestId('dex-5').click();
    await page.keyboard.press('e');
    await expect(page.getByTestId('dex-name')).toHaveText('Pidgey');
    await page.keyboard.press('e');
    await expect(page.getByTestId('dex-name')).toHaveText('Abra');
  });

  test('in Portuguese: the kind, the entry and the numbers too', async ({ page }) => {
    await opened(page, 'pt');
    await page.getByTestId('dex-64').click();
    await expect(page.getByTestId('dex-genus')).toHaveText('Pokémon Psi');
    await expect(page.getByTestId('dex-entry')).toContainText('ondas alfa');
    await expect(page.getByTestId('dex-size')).toHaveText('Altura 1,3 m · Peso 56,5 kg');
    await expect(page.getByTestId('dex-status')).toHaveText('Capturado · você tem 1');
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
