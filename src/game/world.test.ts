// The world: region data, encounters, catching, money and items, the box.

import { describe, expect, it } from 'vitest';
import { ITEMS, RODS, type RodId } from '../data/items';
import { species, speciesBySlug } from '../data/pokedex';
import { city, isUnlocked, KANTO, type HuntKind } from '../data/regions/kanto';
import { createRng } from '../engine/rng';
import { HP_UNITS } from '../fight/constants';
import { addCaught, canSendToBox, canTakeFromBox, sendToBox, swapInParty, takeFromBox } from './box';
import { catchChance, catchValue, DIFFICULTY_PENALTY, throwBall, WILD_SPIRIT } from './capture';
import { addItem, buy, countOf, moneyAfterLoss, prizeMoney, removeItem, START_BAG, START_MONEY, usePotion } from './economy';
import { bestRod, chances, encounterTable, hasEncounters, huntTable, oldFaces, RARE_BITE, rollEncounter, rollIvs, wildPokemon } from './encounters';
import { createPokemon, maxHpOf } from './pokemon';

const id = (slug: string) => speciesBySlug(slug).id;

describe('Kanto', () => {
  it('has its cities in story order, and only the first three are open without badges', () => {
    expect(KANTO.map(c => c.id)).toEqual(['pallet', 'viridian', 'pewter', 'cerulean', 'vermilion', 'lavender', 'celadon', 'fuchsia', 'saffron', 'cinnabar', 'indigo']);
    expect(KANTO.filter(c => isUnlocked(c, 0)).map(c => c.id)).toEqual(['pallet', 'viridian', 'pewter']);
    expect(KANTO.every(c => isUnlocked(c, 8))).toBe(true);
  });

  it('every hunting ground is a real Red/Blue area with Pokémon to find', () => {
    for (const c of KANTO) {
      for (const [kind, areas] of Object.entries(c.hunts) as [HuntKind, string[]][]) {
        for (const area of areas) {
          const found = kind === 'water' ? RODS.some(rod => hasEncounters(area, rod)) : hasEncounters(area, 'walk');
          expect(found, `${c.id} ${kind} ${area}`).toBe(true);
        }
      }
    }
  });

  it('every shop sells real items; the first shop is in Viridian and sells the Old Rod', () => {
    expect(city('pallet').shop).toBeNull();
    expect(city('viridian').shop).toContain('old-rod');
    expect(city('pewter').shop).toContain('good-rod');
    expect(city('saffron').shop).toContain('super-rod');
    for (const c of KANTO) for (const item of c.shop ?? []) expect(ITEMS[item]).toBeDefined();
  });
});

describe('encounters', () => {
  it('Route 1 has Pidgey and Rattata, at their Red/Blue levels', () => {
    const table = encounterTable(city('pallet'), 'grass', null);
    expect(new Set(table.map(e => species(e.speciesId).slug))).toEqual(new Set(['pidgey', 'rattata']));
    const rng = createRng(1);
    for (let i = 0; i < 200; i++) {
      const roll = rollEncounter(table, rng);
      expect(roll.level).toBeGreaterThanOrEqual(2);
      expect(roll.level).toBeLessThanOrEqual(7);
    }
  });

  it('Viridian Forest has Pikachu, but rarely (as in the games)', () => {
    const table = encounterTable(city('pewter'), 'grass', null);
    const rng = createRng(2);
    const rolls = Array.from({ length: 2000 }, () => rollEncounter(table, rng).speciesId);
    const pikachu = rolls.filter(s => s === id('pikachu')).length / rolls.length;
    expect(pikachu).toBeGreaterThan(0);
    expect(pikachu).toBeLessThan(0.1);
  });

  it('fishing needs a rod, and better rods fish different Pokémon', () => {
    const viridian = city('viridian');
    expect(encounterTable(viridian, 'water', null)).toEqual([]);
    const old = new Set(encounterTable(viridian, 'water', 'old-rod').map(e => species(e.speciesId).slug));
    const good = new Set(encounterTable(viridian, 'water', 'good-rod').map(e => species(e.speciesId).slug));
    // Magikarp, plus the better rods' catches of that water now and then (Viridian's Super Rod has Tentacool).
    expect(old).toEqual(new Set(['magikarp', 'poliwag', 'goldeen', 'tentacool']));
    expect(good).toContain('poliwag');
    expect(good).toContain('tentacool');
  });

  it("the Old Rod catches Magikarp, mostly: the Good Rod's Pokémon bite 30% of the time, at the Old Rod's levels", () => {
    const table = encounterTable(city('pallet'), 'water', 'old-rod');
    const rng = createRng(3);
    const rolls = Array.from({ length: 4000 }, () => rollEncounter(table, rng));
    const magikarp = rolls.filter(r => r.speciesId === id('magikarp')).length / rolls.length;
    expect(magikarp).toBeCloseTo(1 - RARE_BITE, 1);
    expect(Math.max(...rolls.map(r => r.level))).toBeLessThanOrEqual(7);
  });

  it('the best rod owned is used', () => {
    expect(bestRod(() => false)).toBeNull();
    expect(bestRod(rod => rod === 'old-rod')).toBe('old-rod');
    expect(bestRod(rod => rod !== 'super-rod')).toBe('good-rod');
  });

  it('wild Pokémon have their own IVs (0–31), the same for the same seed', () => {
    const ivs = rollIvs(createRng(5));
    for (const value of Object.values(ivs)) expect(value >= 0 && value <= 31).toBe(true);
    expect(rollIvs(createRng(5))).toEqual(ivs);
    expect(wildPokemon({ speciesId: id('pidgey'), level: 4 }, createRng(5)).ivs).toEqual(ivs);
  });
});

describe('catching (the Gen 8 formula with a wild spirit, no performance bonus)', () => {
  const x = (catchRate: number, ball: number, wildLevel: number, playerLevel = 50, badges = 0) =>
    catchValue({ catchRate, ball, wildLevel, playerLevel, badges });

  it('matches the plan: a common Pokémon ≈ 30% (3–4 fights), Pikachu ≈ 24%, Snorlax ≈ 5% / 7% / 9%', () => {
    expect(catchChance(x(255, 1, 3))).toBeCloseTo(0.3, 2);
    expect(catchChance(x(190, 1, 5))).toBeCloseTo(0.24, 2);
    expect(catchChance(x(25, 1, 30))).toBeCloseTo(0.053, 2);
    expect(catchChance(x(25, 1.5, 30))).toBeCloseTo(0.072, 2);
    expect(catchChance(x(25, 2, 30))).toBeCloseTo(0.089, 2);
  });

  it('the level no longer matters (no low-level bonus), only the ball and the species', () => {
    expect(x(255, 1, 2)).toBe(x(255, 1, 40));
    expect(x(255, 2, 5)).toBe(2 * x(255, 1, 5));
  });

  it('even a common Pokémon is often not caught on the first try; the Master Ball always catches', () => {
    const rng = createRng(5);
    const first = Array.from({ length: 2000 }, () => throwBall(x(255, 1, 3), rng).caught).filter(Boolean).length / 2000;
    expect(first).toBeGreaterThan(0.25);
    expect(first).toBeLessThan(0.35);
    expect(throwBall(x(3, Infinity, 70), createRng(1)).caught).toBe(true);
  });

  it('a wild Pokémon stronger than yours is much harder to catch (before the 8th badge)', () => {
    expect(x(45, 1, 30, 20)).toBeCloseTo(45 * WILD_SPIRIT * DIFFICULTY_PENALTY);
    expect(x(45, 1, 30, 20, 8)).toBeCloseTo(45 * WILD_SPIRIT);
    expect(x(45, 1, 30, 30)).toBeCloseTo(45 * WILD_SPIRIT);
  });

  it('the shake checks give the formula chance (statistically, with a fixed seed)', () => {
    const value = x(255, 1, 30); // ≈ 30%
    const rng = createRng(11);
    const caught = Array.from({ length: 20_000 }, () => throwBall(value, rng).caught).filter(Boolean).length / 20_000;
    expect(caught).toBeCloseTo(catchChance(value), 1);
  });

  it('a failed throw wobbles 0 to 3 times', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      const result = throwBall(x(3, 1, 50), rng);
      if (!result.caught) expect(result.shakes >= 0 && result.shakes <= 3).toBe(true);
    }
  });
});

describe('money and items', () => {
  it('a new journey starts with 3000 and five Poké Balls', () => {
    expect(START_MONEY).toBe(3000);
    expect(START_BAG).toEqual({ 'poke-ball': 5 });
  });

  it('buying takes the price and adds the item; not without the money', () => {
    expect(buy(1000, {}, 'poke-ball')).toEqual({ ok: true, money: 800, bag: { 'poke-ball': 1 } });
    expect(buy(100, {}, 'poke-ball')).toEqual({ ok: false, reason: 'money' });
  });

  it('a rod is bought once', () => {
    const first = buy(5000, {}, 'old-rod');
    expect(first.ok).toBe(true);
    if (first.ok) expect(buy(first.money, first.bag, 'old-rod')).toEqual({ ok: false, reason: 'owned' });
  });

  it('items are counted and used up', () => {
    const bag = addItem(addItem({}, 'potion'), 'potion');
    expect(countOf(bag, 'potion')).toBe(2);
    expect(removeItem(removeItem(bag, 'potion'), 'potion')).toEqual({});
    expect(() => removeItem({}, 'potion')).toThrow();
  });

  it('potions heal real HP, never above max, and cannot revive', () => {
    const hurt = { ...createPokemon(id('charmander'), 20), hp: 50 };
    expect(usePotion(hurt, 'potion').hp).toBe(50 + 20 * HP_UNITS);
    const nearlyFull = { ...hurt, hp: maxHpOf(hurt) - 10 };
    expect(usePotion(nearlyFull, 'super-potion').hp).toBe(maxHpOf(hurt));
    expect(() => usePotion({ ...hurt, hp: 0 }, 'potion')).toThrow();
  });

  it('trainers pay their levels × 20; losing costs half the money', () => {
    expect(prizeMoney([5, 5, 5])).toBe(300);
    expect(moneyAfterLoss(3001)).toBe(1500);
  });
});

describe('PC box', () => {
  const p = (slug: string) => createPokemon(id(slug), 5);

  it('moves Pokémon between the party and the box, keeping 1 to 6 in the party', () => {
    let team = { party: [p('charmander'), p('pidgey')], box: [p('rattata')] };
    team = sendToBox(team, 1);
    expect(team.party.map(x => x.speciesId)).toEqual([id('charmander')]);
    expect(canSendToBox(team)).toBe(false);
    expect(() => sendToBox(team, 0)).toThrow();
    team = takeFromBox(team, 0);
    expect(team.party.map(x => x.speciesId)).toEqual([id('charmander'), id('rattata')]);
    const full = { party: Array.from({ length: 6 }, () => p('pidgey')), box: [p('rattata')] };
    expect(canTakeFromBox(full)).toBe(false);
  });

  it('a caught Pokémon joins the party, or the box when the party is full', () => {
    expect(addCaught({ party: [p('charmander')], box: [] }, p('pidgey')).where).toBe('party');
    expect(addCaught({ party: Array.from({ length: 6 }, () => p('pidgey')), box: [] }, p('rattata')).where).toBe('box');
  });

  it('the party can be reordered (the first one leads)', () => {
    const party = [p('charmander'), p('pidgey'), p('rattata')];
    expect(swapInParty(party, 2, 0).map(x => x.speciesId)).toEqual([id('rattata'), id('pidgey'), id('charmander')]);
    expect(party[0].speciesId).toBe(id('charmander'));
    expect(() => swapInParty(party, 0, 3)).toThrow();
  });
});

describe('variety: each city feels new', () => {
  const share = (cityId: string, kind: HuntKind, rod: RodId | null, caught: number[] = []) => {
    const here = city(cityId);
    const all = chances(huntTable(here, encounterTable(here, kind, rod), caught));
    const old = oldFaces(cityId);
    return { all, of: (slug: string) => all.find(c => c.speciesId === id(slug))?.chance ?? 0, locals: all.filter(c => !old.has(c.speciesId)).reduce((sum, c) => sum + c.chance, 0) };
  };

  it("a city's own Pokémon are most of what you meet; Pidgey, Rattata and Spearow are no longer everywhere", () => {
    for (const [cityId, kind] of [['viridian', 'grass'], ['pewter', 'grass'], ['cerulean', 'grass'], ['vermilion', 'grass'], ['lavender', 'grass']] as const) {
      expect(share(cityId, kind, null).locals, cityId).toBeGreaterThan(0.6);
    }
    const cerulean = share('cerulean', 'grass', null);
    expect(cerulean.of('pidgey') + cerulean.of('rattata') + cerulean.of('spearow')).toBeLessThan(0.2);
  });

  it("rare ones aren't 1 in 30 anymore: Lavender's Vulpix about 1 in 10, more while you haven't caught one", () => {
    const vulpix = id('vulpix');
    expect(share('lavender', 'grass', null, [vulpix]).of('vulpix')).toBeGreaterThan(0.05);
    expect(share('lavender', 'grass', null).of('vulpix')).toBeGreaterThan(0.08);
    expect(share('lavender', 'grass', null).of('vulpix')).toBeGreaterThan(share('lavender', 'grass', null, [vulpix]).of('vulpix'));
  });

  it("every town's fishing has its locals: Cerulean's Old Rod sometimes hooks Psyduck or Krabby", () => {
    const old = share('cerulean', 'water', 'old-rod');
    expect(old.of('psyduck') + old.of('krabby')).toBeGreaterThan(0.3);
    expect(old.of('magikarp')).toBeGreaterThan(0);
  });

  it('the first city is all new: Pallet is still Pidgey and Rattata', () => {
    const pallet = share('pallet', 'grass', null);
    expect(pallet.of('pidgey')).toBeCloseTo(0.5);
    expect(oldFaces('pallet').size).toBe(0);
  });

  it("Saffron hunts in the Power Plant (no grass of its own: Route 9's Pokémon were all met before)", () => {
    expect(city('saffron').hunts.grass).toBeUndefined();
    expect(share('saffron', 'cave', null).of('magnemite')).toBeGreaterThan(0.2);
  });
});
