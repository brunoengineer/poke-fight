// Progression and saves, played for real: XP after a battle, evolution, the party screen, languages, broken saves.

import { BROKEN_SAVE_KEY, expect, fixture, openGame, reload, save, SAVE_KEY, snapshot, step, test, winBattle } from './helpers';

test.describe('after a battle', () => {
  test('winning gives XP, and the progress survives a reload', async ({ page }) => {
    await openGame(page);
    const before = (await save(page)).party.map(p => p.xp);
    await winBattle(page);
    const results = page.getByTestId('results');
    await expect(results).toBeVisible();
    await expect(results.getByRole('heading')).toHaveText('Victory!');
    await expect(page.getByTestId('results-lines')).toContainText('Charmeleon gained');
    await page.getByTestId('continue').click();
    await expect(results).toBeHidden();

    const after = (await save(page)).party.map(p => p.xp);
    expect(after[0]).toBeGreaterThan(before[0]);
    await reload(page);
    expect((await save(page)).party.map(p => p.xp)).toEqual(after);
  });

  test('the fight is paused while the results are shown', async ({ page }) => {
    await openGame(page);
    await winBattle(page);
    const frame = (await snapshot(page)).frame;
    await step(page, 60);
    expect((await snapshot(page)).frame).toBe(frame);
  });
});

test.describe('evolution', () => {
  test('a Pokémon that reaches its level can evolve after the battle', async ({ page }) => {
    await openGame(page, {}, { save: fixture('save-v1-ready-to-evolve.json') });
    expect((await snapshot(page)).fighters[0].name).toBe('Charmander');
    await winBattle(page);
    await expect(page.getByTestId('results-lines')).toContainText('Charmander grew to Lv. 16!');
    await expect(page.getByTestId('results-prompt')).toHaveText('What? Charmander is evolving!');
    await page.getByTestId('evolve').click();
    await expect(page.getByTestId('results-lines')).toContainText('Charmander evolved into Charmeleon!');
    await page.getByTestId('continue').click();

    expect((await save(page)).party[0].speciesId).toBe(5);
    expect((await snapshot(page)).fighters[0].name).toBe('Charmeleon');
  });

  test('the evolution can be stopped', async ({ page }) => {
    await openGame(page, {}, { save: fixture('save-v1-ready-to-evolve.json') });
    await winBattle(page);
    await page.getByTestId('stop-evolution').click();
    await expect(page.getByTestId('results-lines')).toContainText('Charmander did not evolve.');
    await expect(page.getByTestId('results-prompt')).toHaveCount(0);
    await page.getByTestId('continue').click();
    const charmander = (await save(page)).party[0];
    expect(charmander.speciesId).toBe(4); // still a Charmander…
    expect(charmander.level).toBeGreaterThanOrEqual(16); // …past its evolution level
  });
});

test.describe('party screen', () => {
  test('P opens it and pauses the fight; a new special is used from the next battle', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('p');
    await expect(page.getByTestId('party')).toBeVisible();
    const frame = (await snapshot(page)).frame;
    await step(page, 30);
    expect((await snapshot(page)).frame).toBe(frame);

    await page.getByTestId('special-elemental-0').selectOption('scratch');
    await page.keyboard.press('p');
    await expect(page.getByTestId('party')).toBeHidden();
    expect((await snapshot(page)).fighters[0].loadout.elemental.name).toBe('Scratch');
    expect((await save(page)).party[0].specials.elemental).toBe('scratch');
  });

  test('Heal brings fainted Pokémon back', async ({ page }) => {
    const hurt = fixture('save-v1-new-game.json') as { party: { hp: number }[] };
    hurt.party[1].hp = 0;
    await openGame(page, {}, { save: hurt });
    await page.keyboard.press('p');
    await expect(page.getByTestId('member-1')).toContainText('Fainted');
    await page.getByTestId('heal').click();
    await expect(page.getByTestId('member-1')).not.toContainText('Fainted');
    expect((await save(page)).party[1].hp).toBeGreaterThan(0);
  });

  test('switching to Portuguese changes every text, and is remembered', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('p');
    await page.getByTestId('language').selectOption('pt');
    await expect(page.getByTestId('party').getByRole('heading')).toHaveText('Equipe');
    await expect(page.getByTestId('heal')).toHaveText('Curar equipe');
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('pt-BR');
    await reload(page);
    expect((await save(page)).settings.language).toBe('pt');
    await page.keyboard.press('p');
    await expect(page.getByTestId('party').getByRole('heading')).toHaveText('Equipe');
  });
});

test.describe('saves', () => {
  test('a broken save does not crash the game: a new game starts and the broken one is kept', async ({ page }) => {
    await openGame(page, {}, { save: '{this is not json' });
    expect((await save(page)).party).toHaveLength(3);
    expect(await page.evaluate(key => localStorage.getItem(key), BROKEN_SAVE_KEY)).toBe('{this is not json');
    expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).version, SAVE_KEY)).toBe(1);
  });
});
