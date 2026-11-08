// The world: region data, encounters, catching, money and items, the box.

import { describe, expect, it } from 'vitest';
import { ITEMS, RODS } from '../data/items';
import { species, speciesBySlug } from '../data/pokedex';
import { city, isUnlocked, KANTO, type HuntKind } from '../data/regions/kanto';
import { createRng } from '../engine/rng';
import { HP_UNITS } from '../fight/constants';
import { addCaught, canSendToBox, canTakeFromBox, sendToBox, takeFromBox } from './box';
import { catchChance, catchValue, DIFFICULTY_PENALTY, lowLevelBonus, throwBall } from './capture';
import { addItem, buy, countOf, moneyAfterLoss, prizeMoney, removeItem, START_BAG, START_MONEY, usePotion } from './economy';
import { bestRod, encounterTable, hasEncounters, rollEncounter, rollIvs, wildPokemon } from './encounters';
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
    expect(old).toEqual(new Set(['magikarp']));
    expect(good).toContain('poliwag');
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

describe('catching (Gen 8 formula, no performance bonus)', () => {
  const x = (catchRate: number, ball: number, wildLevel: number, playerLevel = 50, badges = 0) =>
    catchValue({ catchRate, ball, wildLevel, playerLevel, badges });

  it('matches the plan: Lv. 30 Snorlax ≈ 18% / 24% / 30%; Lv. 70 Mewtwo + Ultra ≈ 6%', () => {
    expect(catchChance(x(25, 1, 30))).toBeCloseTo(0.18, 1);
    expect(catchChance(x(25, 1.5, 30))).toBeCloseTo(0.24, 1);
    expect(catchChance(x(25, 2, 30))).toBeCloseTo(0.3, 1);
    expect(catchChance(x(3, 2, 70, 80))).toBeCloseTo(0.06, 1);
  });

  it('common Pokémon (catch rate 255) are always caught; the Master Ball always catches', () => {
    expect(throwBall(x(255, 1, 5), createRng(1))).toEqual({ caught: true, shakes: 3 });
    expect(throwBall(x(3, Infinity, 70), createRng(1)).caught).toBe(true);
  });

  it('low-level Pokémon are easier: (30 − level) / 10 below Lv. 21', () => {
    expect([1, 5, 15, 20, 21, 50].map(lowLevelBonus)).toEqual([2.9, 2.5, 1.5, 1, 1, 1]);
  });

  it('a wild Pokémon stronger than yours is much harder to catch (before the 8th badge)', () => {
    expect(x(45, 1, 30, 20)).toBeCloseTo(45 * DIFFICULTY_PENALTY);
    expect(x(45, 1, 30, 20, 8)).toBe(45);
    expect(x(45, 1, 30, 30)).toBe(45);
  });

  it('the shake checks give the formula chance (statistically, with a fixed seed)', () => {
    const value = x(45, 1, 30); // ≈ 27%
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
});
