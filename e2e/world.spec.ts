// The world loop, played for real: the city, hunting and catching, the shop and the rod, the Pokémon Center, the box,
// the world map, potions, and what losing costs.

import { expect, fixture, openGame, save, scene, snapshot, step, test, winBattle } from './helpers';

type SaveData = { money: number; bag: Record<string, number>; party: { speciesId: number; hp: number }[]; location: string };
const start = () => fixture('save-v3-pallet-starter.json') as SaveData;

test.describe('the city', () => {
  test('shows money and the Pokédex; Pallet Town has grass and water but no shop', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await expect(page.getByTestId('city-heading')).toHaveText('Pallet Town');
    await expect(page.getByTestId('city-money')).toHaveText('₽3000');
    // The Pokédex and the bag sit beside the party, at the bottom, as pictures (drawn by the game).
    await expect(page.getByTestId('city-dex')).toHaveAccessibleName('Pokédex: 2 seen · 1 caught');
    await expect(page.getByTestId('city-bag')).toHaveAccessibleName(/^Bag: \d+ items$/);
    await expect(page.getByTestId('city-dex').locator('img')).toHaveAttribute('src', /^data:image\/png/);
    await expect(page.getByTestId('hunt-grass')).toBeEnabled();
    await expect(page.getByTestId('hunt-water')).toBeDisabled();
    await expect(page.getByTestId('hunt-water')).toContainText('You need a fishing rod');
    await expect(page.getByTestId('city-shop')).toHaveCount(0);
  });

  test('the world map: Viridian and Pewter are open, the rest needs badges', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('city-map').click();
    // The map itself is pixel art drawn on a canvas at its art size (300 × 180), scaled crisp.
    await expect(page.locator('canvas.kanto')).toHaveJSProperty('width', 300);
    await expect(page.getByTestId('place-pallet')).toContainText('You are here');
    await expect(page.getByTestId('go-cerulean')).toBeDisabled();
    await expect(page.getByTestId('place-cerulean')).toContainText('Needs 1 badge(s)');
    // The League and the sanctuary have their own icons (the markers cover them); the panel shows the place's picture.
    await expect(page.getByTestId('place-indigo')).toHaveClass(/league/);
    await expect(page.getByTestId('place-kanto-sanctuary')).toHaveClass(/sanctuary/);
    await expect(page.getByTestId('place-saffron')).toHaveClass(/city/);
    await expect(page.getByTestId('map-preview')).toHaveCSS('background-image', /^url\("data:image\/png/);
    await page.getByTestId('go-cerulean').focus();
    await expect(page.getByTestId('map-preview')).toHaveClass(/locked/);
    await page.getByTestId('go-viridian').click();
    await expect(page.getByTestId('city-heading')).toHaveText('Viridian City');
    expect((await save(page)).location).toBe('viridian');
  });
});

test('every hunting card shows all the species of its ground, as many as it says', async ({ page }) => {
  await openGame(page, { scene: 'city' }, { save: fixture('save-v4-team.json') });
  for (const card of ['hunt-grass', 'hunt-cave']) {
    const kinds = Number((await page.getByTestId(card).innerText()).match(/(\d+) kinds/)![1]);
    await expect(page.getByTestId(card).locator('.place-mon')).toHaveCount(kinds);
  }
});

test.describe('hunting and catching', () => {
  test("the Hidden Grove at the League: the Pokémon nothing else reaches (the starters not chosen, fossils, Lapras…)", async ({ page }) => {
    const badges = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'];
    await openGame(page, { scene: 'city' }, { save: { ...start(), location: 'indigo', badges } });
    const grove = page.getByTestId('hunt-rare');
    await expect(grove).toContainText('Hidden Grove');
    await expect(grove).toContainText('Lv. 30–46 · 12 kinds');
    await grove.click();
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'wild' });
    const wild = (await snapshot(page)).fighters[1].name;
    const groveKanto = ['Bulbasaur', 'Charmander', 'Squirtle', 'Hitmonlee', 'Hitmonchan', 'Lapras', 'Eevee', 'Porygon', 'Omanyte', 'Kabuto', 'Aerodactyl', 'Snorlax'];
    expect(groveKanto).toContain(wild);
  });

  test('the XP bars fill once per battle, a level up included: back after a throw, they stand still', async ({ page }) => {
    // One XP short of Lv. 6 (medium-slow: 179): any win levels Charmander up.
    const data = start() as SaveData & { party: { xp: number }[] };
    data.party[0].xp = 178;
    await openGame(page, { scene: 'city' }, { save: { ...data, bag: { 'poke-ball': 1 } } });
    await page.getByTestId('hunt-grass').click();
    await winBattle(page);
    const card = page.getByTestId('xp-0');
    await expect(card).toHaveClass(/level-up/);
    await expect(card.locator('.fill')).toHaveCSS('animation-name', 'xp-level');
    await page.getByTestId('throw-poke-ball').click();
    await page.getByTestId('capture-done').click();
    await expect(page.getByTestId('results-xp')).toHaveClass(/settled/);
    // Nothing plays again: the bar, the levels, the card itself; the old level is gone, the new one shows.
    await expect(card.locator('.fill')).toHaveCSS('animation-name', 'none');
    await expect(card).toHaveCSS('animation-name', 'none');
    await expect(card.locator('.xp-level.to')).toHaveCSS('animation-name', 'none');
    await expect(card.locator('.xp-level.from')).toBeHidden();
    await expect(card.locator('.xp-level.to')).toBeVisible();
  });

  test('a wild Pokémon in the grass: beat it, throw a Poké Ball; it may break free, so hunt again until one is caught', async ({ page }) => {
    // A common Pokémon is caught about 30% of the time with a Poké Ball: 3–4 fights on average.
    await openGame(page, { scene: 'city' }, { save: { ...start(), bag: { 'poke-ball': 12 } } });
    await page.getByTestId('hunt-grass').click();
    let throws = 0;
    let caught = '';
    while (!caught && throws < 12) {
      expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'wild' });
      const wild = (await snapshot(page)).fighters[1].name;
      expect(['Pidgey', 'Rattata']).toContain(wild);
      await winBattle(page);
      await expect(page.getByTestId('results-prompt')).toHaveText(`The wild ${wild} is worn out! Throw a ball?`);
      // The XP bars fill on this first showing of the results…
      await expect(page.getByTestId('results-xp')).not.toHaveClass(/settled/);
      await expect(page.getByTestId('results-xp').locator('.fill').first()).not.toHaveCSS('animation-name', 'none');
      await page.getByTestId('throw-poke-ball').click();
      throws++;
      // The throw plays out (the tests skip straight to its end): the ball clicked shut, or it burst open.
      const state = await page.locator('.capture-stage').getAttribute('data-state');
      if (state === 'caught') {
        await expect(page.getByTestId('capture-text')).toHaveText(`Gotcha! ${wild} was caught!`);
        caught = wild;
      } else {
        expect(state).toBe('escaped');
        // However many times it wobbled, the message says plainly that it got away.
        await expect(page.getByTestId('capture-text')).toContainText(`${wild} broke free`);
      }
      await page.getByTestId('capture-done').click();
      // …and not again when the results come back after the throw: they stand where they ended.
      await expect(page.getByTestId('results-xp')).toHaveClass(/settled/);
      await expect(page.getByTestId('results-xp').locator('.fill').first()).toHaveCSS('animation-name', 'none');
      if (!caught) {
        await expect(page.getByTestId('results-lines')).toContainText(`broke free and fled`);
        await page.getByTestId('hunt-again').click();
      }
    }
    await expect(page.getByTestId('results-lines')).toContainText(`Gotcha! ${caught} was caught!`);
    await page.getByTestId('continue').click();

    const after = await save(page);
    expect(after.party).toHaveLength(2);
    expect(after.bag['poke-ball']).toBe(12 - throws);
    expect(after.dex.caught).toContain(after.party[1].speciesId);
  });

  test('after a wild battle, Hunt again starts another encounter in the same grass', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    await winBattle(page);
    await page.getByTestId('let-go').click();
    await expect(page.getByTestId('hunt-again')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(await scene(page)).toMatchObject({ scene: 'fight', mode: 'wild' });
    expect(['Pidgey', 'Rattata']).toContain((await snapshot(page)).fighters[1].name);
  });

  test('a defeated wild Pokémon can be let go', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    await winBattle(page);
    await page.getByTestId('let-go').click();
    await expect(page.getByTestId('results-lines')).toContainText('You let the wild');
    await page.getByTestId('continue').click();
    expect((await save(page)).party).toHaveLength(1);
  });

  test('Esc runs away from a wild Pokémon', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city-heading')).toHaveText('Pallet Town');
  });

  test('losing costs half the money; the party is healed and back in the city', async ({ page }) => {
    // The wild Pokémon is a hard CPU, and the player does nothing.
    await openGame(page, { scene: 'city', opponent: 'cpu-hard' }, { save: start() });
    await page.getByTestId('hunt-grass').click();
    for (let i = 0; i < 120 && !(await page.getByTestId('results').isVisible()); i++) await step(page, 60);
    await expect(page.getByTestId('results').getByRole('heading')).toHaveText('Defeat…');
    await expect(page.getByTestId('results-lines')).toContainText('lost ₽1500');
    await page.getByTestId('continue').click();
    const after = await save(page);
    expect(after.money).toBe(1500);
    expect(after.party[0].hp).toBeGreaterThan(0);
  });
});

test.describe('the shop and fishing', () => {
  test("buying Poké Balls and the Old Rod in Viridian; then fishing hooks one of that water's Pokémon", async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: { ...start(), location: 'viridian' } });
    await page.getByTestId('city-shop').click();
    await page.getByTestId('buy-poke-ball').click();
    await expect(page.getByTestId('item-poke-ball')).toContainText('You have 6');
    await expect(page.getByTestId('shop-money')).toHaveText('₽2800');
    // Buying keeps the focus on the item (a controller can buy several in a row).
    await expect(page.getByTestId('buy-poke-ball')).toBeFocused();
    await expect(page.getByTestId('shop-message')).toHaveText('Here you go: one Poké Ball. Thanks!');
    await page.getByTestId('buy-old-rod').click();
    await expect(page.getByTestId('buy-old-rod')).toBeDisabled();
    await expect(page.getByTestId('buy-old-rod')).toContainText('Owned');
    expect((await save(page)).money).toBe(1800);

    await page.getByTestId('back').click();
    await expect(page.getByTestId('hunt-water')).toContainText('With the Old Rod');
    await page.getByTestId('hunt-water').click();
    // The Old Rod: Magikarp, or now and then what the better rods catch in Viridian's water.
    expect(['Magikarp', 'Poliwag', 'Goldeen', 'Tentacool']).toContain((await snapshot(page)).fighters[1].name);
  });

  test('not enough money: nothing is bought', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: { ...start(), location: 'viridian', money: 100 } });
    await page.getByTestId('city-shop').click();
    await page.getByTestId('buy-poke-ball').click();
    await expect(page.getByTestId('shop-message')).toHaveText('Sorry, you don’t have enough money for that.');
    expect((await save(page)).bag['poke-ball']).toBe(5);
  });
});

test.describe('the Pokémon Center, the box and potions', () => {
  test('the box: Y / S sends a Pokémon straight across; the party keeps at least one', async ({ page }) => {
    const data = fixture('save-v2-viridian.json');
    await openGame(page, { scene: 'city' }, { save: data });
    await page.getByTestId('city-box').click();
    await page.getByTestId('party-slot-2').focus();
    await page.keyboard.press('s');
    await page.getByTestId('party-slot-1').focus();
    await page.getByTestId('box-send').click();
    expect((await save(page)).party).toHaveLength(1);
    // The last one: Send says why not, and S does nothing.
    await page.getByTestId('party-slot-0').focus();
    await expect(page.getByTestId('box-send')).toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByTestId('box-blocked')).toHaveText('Your party needs at least one Pokémon');
    await page.keyboard.press('s');
    expect((await save(page)).party).toHaveLength(1);
    await page.getByTestId('box-slot-0').focus();
    await page.keyboard.press('s');
    const after = await save(page);
    expect(after.party).toHaveLength(2);
    expect(after.box).toHaveLength(1);
  });

  test("the box shows each Pokémon's level in its slot's corner, without opening it", async ({ page }) => {
    const data = fixture('save-v2-viridian.json');
    await openGame(page, { scene: 'city' }, { save: data });
    await page.getByTestId('city-box').click();
    await page.getByTestId('party-slot-1').focus();
    await page.keyboard.press('s');
    const moved = (await save(page)).box[0];
    await expect(page.getByTestId('boxed-0').locator('.slot-level')).toHaveText(`Lv${moved.level}`);
  });

  test('the box: A picks a Pokémon up and puts it down: on another one they swap, on an empty place it moves; B puts it back', async ({ page }) => {
    const data = fixture('save-v2-viridian.json');
    await openGame(page, { scene: 'city' }, { save: data });
    const ids = async () => {
      const s = await save(page);
      return [s.party.map(p => p.speciesId), s.box.map(p => p.speciesId)];
    };
    await page.getByTestId('city-box').click();
    await page.getByTestId('party-slot-2').focus();
    await page.keyboard.press('s');
    const [[a, b], [c]] = await ids();

    // In the party: the first and the second swap.
    await page.getByTestId('party-slot-0').click();
    await expect(page.getByTestId('box-holding')).toContainText('Where should');
    await expect(page.getByTestId('party-slot-0')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('party-slot-1').click();
    expect(await ids()).toEqual([[b, a], [c]]);
    await expect(page.getByTestId('box-holding')).toHaveCount(0);

    // Between the box and the party: with the keyboard (Enter picks up, Enter puts down).
    await page.getByTestId('box-slot-0').focus();
    await page.keyboard.press('Enter');
    await page.getByTestId('party-slot-0').focus();
    await page.keyboard.press('Enter');
    expect(await ids()).toEqual([[c, a], [b]]);

    // On the empty place after the party: it joins it.
    await page.getByTestId('box-slot-0').click();
    await page.getByTestId('party-drop').click();
    expect(await ids()).toEqual([[c, a, b], []]);

    // B (Esc) puts it back, and stays in the box.
    await page.getByTestId('party-slot-0').click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('box-holding')).toHaveCount(0);
    await expect(page.getByTestId('party-slot-0')).toHaveAttribute('aria-pressed', 'false');
    expect(await ids()).toEqual([[c, a, b], []]);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('city')).toBeVisible();
  });

  test('Tab (Select on a controller) opens the map from the city, and closes it again', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: fixture('save-v2-viridian.json') });
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('map')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByTestId('city')).toBeVisible();
  });

  test('a potion from the party screen heals, and is used up', async ({ page }) => {
    const data = start();
    data.party[0].hp = 50;
    data.bag = { 'poke-ball': 5, potion: 1 };
    await openGame(page, { scene: 'city' }, { save: data });
    await page.keyboard.press('p');
    await page.getByTestId('use-potion-0').click();
    const after = await save(page);
    expect(after.party[0].hp).toBeGreaterThan(50);
    expect(after.bag.potion).toBeUndefined();
    await expect(page.getByTestId('use-potion-0')).toHaveCount(0);
  });
});

test.describe('the battle field', () => {
  test('beating the trainers pays prize money', async ({ page }) => {
    await openGame(page, { scene: 'city' }, { save: start() });
    await page.getByTestId('city-training').click();
    expect(await scene(page)).toMatchObject({ mode: 'trainer' });
    await winBattle(page);
    // Three Lv. 5 Pokémon: (5 + 5 + 5) × 12.
    await expect(page.getByTestId('results-lines')).toContainText('You got ₽180 for winning!');
    await page.getByTestId('continue').click();
    expect((await save(page)).money).toBe(3180);
  });
});
