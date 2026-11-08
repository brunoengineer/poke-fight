// The fight sandbox, played with real key presses (and a fake controller), frame by frame.

import { battle, expect, openGame, snapshot, step, test } from './helpers';

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

  test('Space dashes forward, Space + back dashes back', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('Space');
    await step(page, 1);
    expect((await snapshot(page)).fighters[0]).toMatchObject({ action: 'dash', actionFrame: 1 });
    await step(page, 30);
    await page.keyboard.down('a');
    await page.keyboard.press('Space');
    await step(page, 1);
    await page.keyboard.up('a');
    expect((await snapshot(page)).fighters[0]).toMatchObject({ action: 'backdash', actionFrame: 1 });
  });

  test('a jump can be steered in the air', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('w');
    await step(page, 5); // in the air from frame 4
    const x = (await snapshot(page)).fighters[0].x;
    await page.keyboard.down('d');
    await step(page, 10);
    await page.keyboard.up('d');
    expect((await snapshot(page)).fighters[0].x).toBeGreaterThan(x);
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

test.describe('specials and guard', () => {
  test('K fires the elemental special and spends a quarter of the PP bar', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('k');
    await step(page, 1);
    expect((await snapshot(page)).fighters[0]).toMatchObject({ action: 'elemental', pp: 25 });
    await step(page, 14);
    expect((await snapshot(page)).projectiles).toHaveLength(1);
  });

  test('L guards while held', async ({ page }) => {
    await openGame(page);
    await page.keyboard.down('l');
    await step(page, 5);
    expect((await snapshot(page)).fighters[0].action).toBe('guard');
    await page.keyboard.up('l');
    await step(page, 1);
    expect((await snapshot(page)).fighters[0].action).toBe('guardEnd');
  });

  test('I needs a full PP bar; F3 (infinite PP) makes it available', async ({ page }) => {
    await openGame(page);
    await page.keyboard.press('i');
    await step(page, 1);
    expect((await snapshot(page)).fighters[0].action).toBe('idle');
    await page.keyboard.press('F3');
    await step(page, 1);
    await page.keyboard.press('i');
    await step(page, 1);
    expect((await snapshot(page)).fighters[0].action).toBe('big');
  });
});

test.describe('battle', () => {
  test('beat the whole dummy team: each KO brings in the next one; Enter starts a new battle', async ({ page }) => {
    await openGame(page);
    const names: string[] = [];
    await page.keyboard.down('d');
    for (let i = 0; i < 200; i++) {
      const b = await battle(page);
      if (b.phase === 'over') break;
      if (b.phase === 'fight' && !names.includes(b.round.fighters[1].name)) names.push(b.round.fighters[1].name);
      await page.keyboard.press('j');
      await step(page, 30);
    }
    await page.keyboard.up('d');
    const over = await battle(page);
    expect(over).toMatchObject({ phase: 'over', winner: 0, rounds: 3 });
    expect(names).toEqual(['Sprout', 'Spark', 'Boulder']);

    await page.keyboard.press('Enter');
    expect(await battle(page)).toMatchObject({ phase: 'fight', rounds: 1, winner: null });
  });

  test('when your Pokémon faints, you choose the next one', async ({ page }) => {
    await openGame(page);
    // The dummy fires specials on a rhythm, with infinite PP; player 1 just stands there.
    await page.keyboard.press('F3');
    for (let i = 0; i < 4; i++) await page.keyboard.press('F2');
    expect((await page.evaluate(() => window.__pf!.debug())).dummy).toBe('special');
    for (let i = 0; i < 40 && (await battle(page)).phase !== 'choose'; i++) await step(page, 60);

    const choosing = await battle(page);
    expect(choosing.phase).toBe('choose');
    expect(choosing.cursor).toBe(1);
    await page.keyboard.press('ArrowDown');
    await step(page, 1);
    expect((await battle(page)).cursor).toBe(2);
    await page.keyboard.press('j');
    await step(page, 1);
    const next = await battle(page);
    expect(next.phase).toBe('fight');
    expect(next.round.fighters[0].name).toBe('Brawler');
  });
});

test.describe('sandbox', () => {
  test('R resets the battle at any time', async ({ page }) => {
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

  test('the debug overlay measures frame advantage: the tackle is +3 on hit', async ({ page }) => {
    await openGame(page);
    // Walk up close, stop, attack.
    await page.keyboard.down('d');
    await step(page, 50);
    await page.keyboard.up('d');
    await step(page, 1);
    await page.keyboard.press('j');
    await step(page, 60);
    expect((await page.evaluate(() => window.__pf!.debug())).advantage).toEqual({ kind: 'hit', value: 3 });
  });
});
