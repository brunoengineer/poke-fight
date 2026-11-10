// Versus (plan.md §4.10): two players pick three Pokémon each, fight (no switching; whoever lost a Pokémon picks the
// next one), and the winner's screen leads back to the selection. Player 1 plays on the keyboard; player 2 on a
// stand-in controller (window.__pf.versusPad: the tests have no real one).

import type { Page } from '@playwright/test';
import { expect, openGame, step, test } from './helpers';

// fight/input.ts Button bits.
const CONFIRM = 1 << 9;
const PHYSICAL = 1 << 4;
const RIGHT = 1 << 1;

/** Player 2's controller holds these buttons for a couple of screen frames, then lets go. */
async function padTap(page: Page, mask: number) {
  const frames = () => page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
  await page.evaluate(m => window.__pf!.versusPad(m), mask);
  await frames();
  await page.evaluate(() => window.__pf!.versusPad(0));
  await frames();
}

async function pickTeams(page: Page) {
  await openGame(page, { scene: 'title' });
  await page.getByTestId('versus-mode').click();
  await expect(page.getByTestId('versus')).toBeVisible();
  // No controller yet: player 2's side waits for one.
  await expect(page.getByTestId('vs-p2')).toHaveClass(/waiting/);
  await page.evaluate(() => window.__pf!.versusPad(0));
  await expect(page.getByTestId('vs-p2')).not.toHaveClass(/waiting/);
  await expect(page.getByTestId('vs-p2')).toContainText('Controller 1');
  // Player 1 (keyboard): Bulbasaur, Ivysaur, Venusaur, then ready.
  for (const key of ['j', 'd', 'j', 'd', 'j']) await page.keyboard.press(key);
  await expect(page.getByTestId('vs-slot-1-3')).toContainText('Venusaur');
  await page.keyboard.press('j');
  await expect(page.getByTestId('vs-p1')).toHaveClass(/ready/);
  // Player 2 (controller): Bulbasaur, Ivysaur, Venusaur too (each team picks for itself), then ready.
  for (const mask of [CONFIRM, RIGHT, CONFIRM, RIGHT, CONFIRM]) await padTap(page, mask);
  await expect(page.getByTestId('vs-slot-2-3')).toContainText('Venusaur');
  await padTap(page, CONFIRM);
}

test('the selection: only what the journey opened (Kanto, without a save), three each, then ready: the fight starts', async ({ page }) => {
  await pickTeams(page);
  await expect(page.getByTestId('vs-p1').locator('.vs-cell')).toHaveCount(151);
  await expect.poll(() => page.evaluate(() => window.__pf!.scene())).toMatchObject({ scene: 'fight', mode: 'versus' });
  const battle = await page.evaluate(() => window.__pf!.battle());
  expect(battle.teams.map(team => team.map(m => `${m.name} ${m.level}`))).toEqual([
    ['Bulbasaur 100', 'Ivysaur 100', 'Venusaur 100'],
    ['Bulbasaur 100', 'Ivysaur 100', 'Venusaur 100'],
  ]);
  expect(battle.versus).not.toBeNull();
});

test('a fight to the end: player 2 picks its next Pokémon after each faint; the winner; back to the selection', async ({ page }) => {
  await pickTeams(page);
  await expect.poll(() => page.evaluate(() => window.__pf!.scene())).toMatchObject({ scene: 'fight', mode: 'versus' });
  // Tab does nothing in Versus.
  await page.keyboard.press('Tab');
  await expect(page.getByTestId('toast')).toContainText('No switching in Versus');
  // Player 1 walks in and tackles; player 2 stands, and chooses when it has to.
  await page.keyboard.down('d');
  for (let i = 0; i < 900; i++) {
    const battle = await page.evaluate(() => window.__pf!.battle());
    if (battle.phase === 'over') break;
    if (battle.phase === 'choose' && battle.versus?.choosing[1]) {
      await page.evaluate(m => window.__pf!.versusPad(m), PHYSICAL);
      await step(page, 1);
      await page.evaluate(() => window.__pf!.versusPad(0));
      await step(page, 1);
      continue;
    }
    await page.keyboard.press('j');
    await step(page, 30);
  }
  await page.keyboard.up('d');
  await expect(page.getByTestId('versus-winner')).toBeVisible();
  await expect(page.getByTestId('vs-headline')).toHaveText('Player 1 wins!');
  await page.getByTestId('vs-again').click();
  // Back to the selection, the same teams already picked: one press each to be ready again.
  await expect(page.getByTestId('versus')).toBeVisible();
  await expect(page.getByTestId('vs-slot-1-1')).toContainText('Bulbasaur');
  await expect(page.getByTestId('vs-p1')).not.toHaveClass(/ready/);
});

test('the grid scrolls with the cursor, down to the last row and back up to the first', async ({ page }) => {
  await openGame(page, { scene: 'title' });
  await page.getByTestId('versus-mode').click();
  const grid = page.getByTestId('vs-p1').locator('.vs-grid-wrap');
  /** Whether the cursor's cell is fully inside the grid's visible part. */
  const cursorShown = () =>
    grid.evaluate(wrap => {
      const box = wrap.getBoundingClientRect();
      const cell = wrap.querySelector('.vs-cell.cursor')!.getBoundingClientRect();
      return cell.top >= box.top - 1 && cell.bottom <= box.bottom + 1;
    });
  // Kanto: 151 Pokémon, 16 rows of 10.
  for (let row = 0; row < 15; row++) {
    await page.keyboard.press('s');
    expect(await cursorShown(), `down, row ${row + 2}`).toBe(true);
  }
  await expect(grid).not.toHaveJSProperty('scrollTop', 0);
  for (let row = 0; row < 15; row++) {
    await page.keyboard.press('w');
    expect(await cursorShown(), `up, row ${15 - row}`).toBe(true);
  }
  // Back at the top: Bulbasaur is under the cursor, and the grid is scrolled all the way up.
  await expect(page.getByTestId('vs-p1').locator('.vs-focus')).toContainText('Bulbasaur');
  expect(await grid.evaluate(wrap => wrap.scrollTop)).toBeLessThan(40);
});
