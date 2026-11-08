// The fight sandbox, played with real key presses (and a fake controller), frame by frame.

import { expect, openGame, snapshot, step, test } from './helpers';

test.describe('responsive controls', () => {
  test('an attack starts on the very next frame after the key press', async ({ page }) => {
    await openGame(page);
    await page.keyboard.down('j');
    await step(page, 1);
    expect((await snapshot(page)).fighters[0]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });

  test('a tap shorter than one frame still counts', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('j'); // down and up before the next frame
    await step(page, 1);
    expect((await snapshot(page)).fighters[0].action).toBe('attack');
  });

  test('D and the right arrow both walk forward, 2 px per frame', async ({ page }) => {
    await openGame(page);
    const x0 = (await snapshot(page)).fighters[0].x;
    for (const key of ['d', 'ArrowRight']) {
      await page.keyboard.down(key);
      await step(page, 10);
      await page.keyboard.up(key);
    }
    expect((await snapshot(page)).fighters[0].x - x0).toBe(20 * 2 * 256);
  });

  test('keys are released when the window loses focus', async ({ page }) => {
    await openGame(page);
    await page.keyboard.down('d');
    await step(page, 1);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const x = (await snapshot(page)).fighters[0].x;
    await step(page, 10);
    expect((await snapshot(page)).fighters[0].x).toBe(x);
  });

  test('a controller works: X attacks', async ({ page }) => {
    await page.addInitScript(() => {
      const pad = {
        id: 'Test pad',
        index: 0,
        connected: true,
        mapping: 'standard',
        timestamp: 0,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      };
      (window as unknown as { testPad: typeof pad }).testPad = pad;
      navigator.getGamepads = () => [pad as unknown as Gamepad, null, null, null];
    });
    await openGame(page);
    await page.evaluate(() => {
      (window as unknown as { testPad: { buttons: { pressed: boolean }[] } }).testPad.buttons[2].pressed = true;
    });
    await step(page, 1);
    expect((await snapshot(page)).fighters[0]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });
});

test.describe('sandbox', () => {
  test('knock out the dummy, then Enter starts a new fight', async ({ page }) => {
    await openGame(page);
    // Walk into the dummy (pushing it to the wall) and attack on a rhythm until it falls.
    await page.keyboard.down('d');
    for (let i = 0; i < 40 && (await snapshot(page)).winner === null; i++) {
      await page.keyboard.press('j');
      await step(page, 30);
    }
    await page.keyboard.up('d');
    const ko = await snapshot(page);
    expect(ko.winner).toBe(0);
    expect(ko.fighters[1]).toMatchObject({ hp: 0, action: 'ko' });

    await page.keyboard.press('Enter');
    const fresh = await snapshot(page);
    expect(fresh.winner).toBeNull();
    expect(fresh.fighters.map(f => f.hp)).toEqual([1000, 1000]);
  });

  test('R resets the fight at any time', async ({ page }) => {
    await openGame(page);
    await page.keyboard.down('d');
    await step(page, 20);
    await page.keyboard.up('d');
    await page.keyboard.press('r');
    expect((await snapshot(page)).frame).toBe(0);
  });

  test('F1 shows the debug overlay, F2 changes the dummy', async ({ page }) => {
    await openGame(page);
    const debug = () => page.evaluate(() => window.__pf!.debug());
    expect(await debug()).toMatchObject({ overlay: false, dummy: 'stand' });
    await page.keyboard.press('F1');
    await page.keyboard.press('F2');
    expect(await debug()).toMatchObject({ overlay: true, dummy: 'jump' });
    await step(page, 10);
    expect((await snapshot(page)).fighters[1].y).toBeGreaterThan(0);
  });

  test('the debug overlay measures frame advantage: the attack is +3 on hit', async ({ page }) => {
    await openGame(page);
    // Walk up close, stop, attack.
    await page.keyboard.down('d');
    await step(page, 50);
    await page.keyboard.up('d');
    await step(page, 1);
    await page.keyboard.press('j');
    await step(page, 60);
    expect((await page.evaluate(() => window.__pf!.debug())).advantage).toBe(3);
  });
});
