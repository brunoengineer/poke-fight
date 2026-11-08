// Shared tools for the browser tests.
//   - Every test fails on a page error or a console error.
//   - Requests to other sites (the Pokémon sprites) are stubbed with a 1-pixel image, so tests run offline and fast;
//     the game draws its stand-in rectangles instead.
//   - The game is opened in test mode (see src/test/hooks.ts): fixed seed and a manual clock.
//   - Player 2 is a standing dummy unless the test asks for another opponent (the game's default is the CPU).

import { readFileSync } from 'node:fs';
import { test as base, expect, type Page } from '@playwright/test';
// Brings in the `window.__pf` type (the hooks file declares it globally).
import type { TestApi } from '../src/test/hooks';

export type { TestApi };

const PIXEL = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(`page error: ${error.message}`));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(`console: ${message.text()}`);
    });
    await page.route(url => url.hostname !== 'localhost', route => {
      // The game loads sprites as crossOrigin (to trim them), so the stub must allow it like the real host does.
      if (route.request().resourceType() === 'image') {
        return route.fulfill({ contentType: 'image/png', body: PIXEL, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      return route.abort();
    });
    await use(page);
    expect(errors, 'the game logged errors during this test').toEqual([]);
  },
});

export { expect };

/** A save kept in src/state/fixtures/ (the same files the unit tests load). */
export const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(new URL(`../src/state/fixtures/${name}`, import.meta.url), 'utf8'));

// The storage keys (as in src/state/store.ts: the browser tests can't import game code that loads the JSON data).
export const SAVE_KEY = 'poke-fight.save';
export const BROKEN_SAVE_KEY = 'poke-fight.save.broken';

/**
 * Opens the game in test mode and waits until the test hooks are ready.
 * `save`: the game starts from this saved game (written once per test, so a reload keeps the game's own changes).
 */
export async function openGame(page: Page, params: Record<string, string> = {}, setup: { save?: unknown } = {}) {
  if (setup.save !== undefined) {
    await page.addInitScript(
      ({ key, value }) => {
        if (sessionStorage.getItem('seeded')) return;
        localStorage.setItem(key, value);
        sessionStorage.setItem('seeded', '1');
      },
      { key: SAVE_KEY, value: typeof setup.save === 'string' ? setup.save : JSON.stringify(setup.save) },
    );
  }
  const query = new URLSearchParams({ test: '1', opponent: 'stand', ...params });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__pf !== undefined);
}

/** Reloads the page (same URL) and waits for the game again. */
export async function reload(page: Page) {
  await page.reload();
  await page.waitForFunction(() => window.__pf !== undefined);
}

export const save = (page: Page) => page.evaluate(() => window.__pf!.save());

/** Walks into the opponent and tackles every 30 frames until the battle is over (the standing dummy never fights back). */
export async function winBattle(page: Page, maxTackles = 300) {
  await page.keyboard.down('d');
  for (let i = 0; i < maxTackles; i++) {
    if ((await page.evaluate(() => window.__pf!.battle().phase)) === 'over') break;
    await page.keyboard.press('j');
    await step(page, 30);
  }
  await page.keyboard.up('d');
}

export const frame = (page: Page) => page.evaluate(() => window.__pf!.frame());
export const step = (page: Page, frames: number) => page.evaluate(n => window.__pf!.step(n), frames);
export const snapshot = (page: Page) => page.evaluate(() => window.__pf!.snapshot());
export const battle = (page: Page) => page.evaluate(() => window.__pf!.battle());
