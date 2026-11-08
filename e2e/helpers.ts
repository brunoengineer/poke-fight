// Shared tools for the browser tests.
//   - Every test fails on a page error or a console error.
//   - Requests to other sites (sprites, later) are stubbed, so tests run offline and fast.
//   - The game is opened in test mode (see src/test/hooks.ts): fixed seed and a manual clock.

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
      if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/png', body: PIXEL });
      return route.abort();
    });
    await use(page);
    expect(errors, 'the game logged errors during this test').toEqual([]);
  },
});

export { expect };

/** Opens the game in test mode and waits until the test hooks are ready. */
export async function openGame(page: Page, params: Record<string, string> = {}) {
  const query = new URLSearchParams({ test: '1', ...params });
  await page.goto(`/?${query}`);
  await page.waitForFunction(() => window.__pf !== undefined);
}

export const frame = (page: Page) => page.evaluate(() => window.__pf!.frame());
export const step = (page: Page, frames: number) => page.evaluate(n => window.__pf!.step(n), frames);
export const snapshot = (page: Page) => page.evaluate(() => window.__pf!.snapshot());
