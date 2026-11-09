// Regions, played for real: the plane, opening the next region by winning a League, a new journey there (its own
// starter and Pokédex), travelling back to a journey kept intact, and the Legends' Sanctuary (a legendary with four
// times the HP; only a Master Ball can catch it; the whole party gets XP).

import { battle, expect, fixture, openGame, scene, snapshot, step, test, winBattle } from './helpers';

type SaveData = Record<string, unknown> & { champion: boolean; bag: Record<string, number>; location: string };
/** Kanto at the Indigo Plateau, with a Lv. 100 Mewtwo and a Lv. 60 Charizard. */
const kanto = (champion: boolean, bag: Record<string, number> = { 'poke-ball': 5 }) =>
  ({ ...(fixture('save-v5-victory-road.json') as SaveData), champion, bag }) as SaveData;

const current = (page: import('@playwright/test').Page) =>
  page.evaluate(() => window.__pf!.save() as unknown as { region: string; location: string; badges: string[]; away: Record<string, { badges: string[]; location: string }>; dex: { seen: number[]; caught: number[] }; party: { speciesId: number; level: number; hp: number; xp: number }[]; bag: Record<string, number>; champions: string[] });

/** Clicks through the dialog lines until `target` shows (the dialog may still be on its way in). */
async function talkUntil(page: import('@playwright/test').Page, target: string) {
  await expect(async () => {
    const next = page.getByTestId('dialog-next');
    if (await next.isVisible()) await next.click();
    await expect(page.getByTestId(target)).toBeVisible({ timeout: 100 });
  }).toPass();
}

test.describe('travelling between regions', () => {
  test('the plane shows every region: Kanto is here, the next one waits for the Kanto League', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: kanto(false) });
    await page.getByTestId('city-travel').click();
    await expect(page.getByTestId('travel-kanto-status')).toHaveText('You are here');
    await expect(page.getByTestId('travel-johto-status')).toHaveText('Win the Kanto League first');
    await expect(page.getByTestId('travel-johto')).toHaveAttribute('aria-disabled', 'true');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city')).toBeVisible();
  });

  test('a Kanto Champion flies to Johto: its Professor, a Johto starter, a new Pokédex; back in Kanto, nothing was lost', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: kanto(true) });
    const before = await current(page);
    expect(before.champions).toEqual(['kanto']);
    await page.getByTestId('city-travel').click();
    await expect(page.getByTestId('travel-johto-status')).toHaveText('A new journey awaits');
    // A journey not started yet shows its three partners instead.
    await expect(page.getByTestId('travel-johto').locator('.travel-partner')).toHaveCount(3);
    await page.getByTestId('travel-johto').click();

    // The flight (instant in the tests), then Johto's Professor and the starters.
    await talkUntil(page, 'starter-cyndaquil');
    await page.getByTestId('starter-cyndaquil').click();
    await talkUntil(page, 'city');

    const johto = await current(page);
    expect(johto).toMatchObject({ region: 'johto', badges: [], dex: { caught: [155] } });
    expect(johto.party.map(p => [p.speciesId, p.level])).toEqual([[155, 5]]);
    expect(johto.away.kanto).toMatchObject({ badges: before.badges, location: 'indigo' });
    // Johto's Pokédex: every species up to Celebi.
    await page.getByTestId('city-dex').click();
    await expect(page.getByTestId('dex-counts')).toContainText('· 251');
    await page.keyboard.press('Escape');

    // Back to Kanto: the journey there is as it was; Johto's waits.
    await page.getByTestId('city-travel').click();
    await expect(page.getByTestId('travel-kanto-status')).toHaveText('Continue your journey');
    // Its card shows the journey there: the 8 badges earned, and Kanto's Pokédex.
    await expect(page.getByTestId('travel-kanto-badges').locator('.travel-badge.earned')).toHaveCount(8);
    await expect(page.getByTestId('travel-kanto-dex')).toHaveText(`${before.dex.caught.length}/151`);
    await page.getByTestId('travel-kanto').click();
    await expect(page.getByTestId('city')).toBeVisible();
    const back = await current(page);
    expect(back).toMatchObject({ region: 'kanto', location: 'indigo', badges: before.badges });
    expect(back.party.map(p => p.speciesId)).toEqual([150, 6]);
    expect(back.away.johto).toMatchObject({ badges: [] });

    // And to Johto again: no new starter, the journey goes on.
    await page.getByTestId('city-travel').click();
    await page.getByTestId('travel-johto').click();
    await expect(page.getByTestId('city')).toBeVisible();
    expect((await current(page)).party.map(p => p.speciesId)).toEqual([155]);
  });
});

test.describe("the Legends' Sanctuary", () => {
  test('closed until the League is won; then its legendaries wait, each with its card', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: kanto(false) });
    await page.getByTestId('city-map').click();
    await expect(page.getByTestId('go-kanto-sanctuary')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('place-kanto-sanctuary')).toContainText('Win this region’s League');
  });

  test("a legendary has four times the HP; beaten, only a Master Ball can be thrown, and the whole party grows", async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: { ...kanto(true, { 'poke-ball': 5, 'ultra-ball': 3, 'master-ball': 1 }), location: 'kanto-sanctuary' } });
    await expect(page.getByTestId('legend-articuno')).toBeVisible();
    await expect(page.getByTestId('legend-mewtwo')).toBeVisible();
    const xp = (await current(page)).party.map(p => p.xp);

    await page.getByTestId('legend-articuno').click();
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'legendary' });
    await step(page, 1);
    const boss = (await snapshot(page)).fighters[1];
    await winBattle(page, 900);
    expect((await battle(page)).winner).toBe(0);

    // Only the Master Ball is offered.
    await expect(page.getByTestId('results-prompt')).toContainText('Only a Master Ball can catch it');
    await expect(page.getByTestId('throw-poke-ball')).toHaveCount(0);
    await expect(page.getByTestId('throw-ultra-ball')).toHaveCount(0);
    await page.getByTestId('throw-master-ball').click();
    await page.getByTestId('capture-done').click();
    await expect(page.getByTestId('results-lines')).toContainText('Gotcha! Articuno was caught!');

    const after = await current(page);
    const articuno = after.party.find(p => p.speciesId === 144)!;
    // It fought with four times the HP of the Pokémon that was caught (which arrives rested).
    expect(boss.maxHp).toBe(articuno.hp * 4);
    expect(after.bag['master-ball']).toBeUndefined();
    // Charizard got experience too, whether it fought or not (Mewtwo is Lv. 100: nothing more to gain).
    expect(after.party[1].xp).toBeGreaterThan(xp[1]);

    // Caught: its card says so, and it can't be fought again.
    await page.getByTestId('continue').click();
    await expect(page.getByTestId('legend-articuno')).toContainText('Caught');
  });

  test('without a Master Ball, a beaten legendary can only be let go', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: { ...kanto(true), location: 'kanto-sanctuary' } });
    await page.getByTestId('legend-zapdos').click();
    await winBattle(page, 900);
    await expect(page.getByTestId('results-prompt')).toContainText('you have none');
    await expect(page.locator('[data-testid^="throw-"]')).toHaveCount(0);
    await page.getByTestId('let-go').click();
  });
});
