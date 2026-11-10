// Moves of their own (plan.md §4.9): a famous Pokémon's signature move, shown in the party and used in a fight.

import { expect, fixture, openGame, snapshot, step, test } from './helpers';

/** The pallet starter save, its Pokémon turned into a Pikachu (Lv. 5, the same XP fits its growth). */
function pikachuSave() {
  const data = fixture('save-v3-pallet-starter.json') as { party: { speciesId: number; specials: { elemental: string; big: string }; moves: string[] }[] };
  data.party[0].speciesId = 25;
  data.party[0].moves = ['thunder-shock', 'growl'];
  data.party[0].specials = { elemental: 'thunder-shock', big: 'thunder-shock' };
  return data;
}

test('the party shows Pikachu’s signature move, with its input', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: pikachuSave() });
  await page.keyboard.press('p');
  const own = page.getByTestId('own-move-0');
  await expect(own).toContainText('Signature move (←↓→ + J)');
  await expect(own).toContainText('Thunder');
  await expect(own).toContainText('Free · Strike');
});

test('back, down, forward + J in a fight: Thunder (free), with its name on screen', async ({ page }) => {
  await openGame(page, { scene: 'city', opponent: 'stand' }, { save: pikachuSave() });
  await page.getByTestId('hunt-grass').click();
  await step(page, 5);
  const pp = (await snapshot(page)).fighters[0].pp;
  // Facing right: ← (A), ↓ (S), → (D) + J, a frame each.
  for (const [keys, frames] of [[['a'], 1], [['s'], 1], [['d', 'j'], 1]] as const) {
    for (const k of keys) await page.keyboard.down(k);
    await step(page, frames);
    for (const k of keys) await page.keyboard.up(k);
  }
  await step(page, 2);
  const me = (await snapshot(page)).fighters[0];
  expect(me).toMatchObject({ action: 'big', bigKind: 'signature', pp });
});
