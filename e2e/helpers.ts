// Shared tools for the browser tests.
//   - Every test fails on a page error or a console error.
//   - Requests to other sites are stubbed, so tests run offline and fast: sprites become a 1-pixel image (the game
//     draws its stand-in rectangles), web fonts an empty stylesheet, cries an empty answer.
//   - The game is opened in test mode (see src/test/hooks.ts): fixed seed and a manual clock.
//   - Player 2 is a standing dummy unless the test asks for another opponent (the game's default is the CPU).
//   - The game opens straight into Training (`scene: 'training'`) unless the test asks for the title
//     (`scene: 'title'`). Training without a saved journey is the demo (Lv. 30 teams, no XP).
//   - The trainers' entrance (Poké Balls thrown before each Pokémon) is off (`entrance: '0'`), so fights start on
//     frame 0; e2e/entrance.spec.ts turns it on.

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
      const type = route.request().resourceType();
      // The game loads sprites as crossOrigin (to trim them), so the stub must allow it like the real host does.
      if (type === 'image') {
        return route.fulfill({ contentType: 'image/png', body: PIXEL, headers: { 'Access-Control-Allow-Origin': '*' } });
      }
      // Web fonts: an empty stylesheet (the game falls back to system fonts). Cries and anything else: empty.
      if (type === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
      return route.fulfill({ status: 200, body: '', headers: { 'Access-Control-Allow-Origin': '*' } });
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
  const query = new URLSearchParams({ test: '1', opponent: 'stand', scene: 'training', entrance: '0', ...params });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__pf !== undefined);
}

/** Reloads the page (same URL) and waits for the game again. */
export async function reload(page: Page) {
  await page.reload();
  await page.waitForFunction(() => window.__pf !== undefined);
}

export const save = (page: Page) => page.evaluate(() => window.__pf!.save());
export const scene = (page: Page) => page.evaluate(() => window.__pf!.scene());

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

/** The standard gamepad layout's button numbers (as in src/engine/input/gamepad.ts). */
export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, Back: 8, Start: 9, Up: 12, Down: 13, Left: 14, Right: 15 } as const;

/**
 * A fake controller (call before openGame): the game reads it through navigator.getGamepads like a real one.
 * `press(button)` holds the button for a few animation frames, then releases it.
 */
export async function fakePad(page: Page) {
  await page.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }));
    const pad = { connected: true, id: 'fake', index: 0, buttons, axes: [0, 0, 0, 0], mapping: 'standard', timestamp: 0 };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad] });
    (window as unknown as { __fakePad: typeof buttons }).__fakePad = buttons;
  });
  return {
    async press(button: number) {
      await page.evaluate(async index => {
        const buttons = (window as unknown as { __fakePad: { pressed: boolean }[] }).__fakePad;
        const frames = (n: number) => new Promise<void>(done => {
          const tick = () => (n-- <= 0 ? done() : requestAnimationFrame(tick));
          requestAnimationFrame(tick);
        });
        buttons[index].pressed = true;
        await frames(3);
        buttons[index].pressed = false;
        await frames(3);
      }, button);
    },
  };
}
