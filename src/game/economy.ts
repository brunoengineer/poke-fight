// Money, the bag, potions, prize money, and what losing a battle costs. Pure: functions return new values.

import { HP_UNITS } from '../fight/constants';
import { ITEMS, type ItemId } from '../data/items';
import { maxHpOf, type Pokemon } from './pokemon';

/** Item id → how many (rods count 1). */
export type Bag = Partial<Record<ItemId, number>>;

export const START_MONEY = 3000;
export const START_BAG: Bag = { 'poke-ball': 5 };
/** Money never goes above this (as in the games). */
export const MAX_MONEY = 999_999;

export const countOf = (bag: Bag, id: ItemId) => bag[id] ?? 0;

export function addItem(bag: Bag, id: ItemId, count = 1): Bag {
  return { ...bag, [id]: countOf(bag, id) + count };
}

export function removeItem(bag: Bag, id: ItemId, count = 1): Bag {
  const left = countOf(bag, id) - count;
  if (left < 0) throw new Error(`Not enough ${id}`);
  const next = { ...bag };
  if (left === 0) delete next[id];
  else next[id] = left;
  return next;
}

export type BuyResult = { ok: true; money: number; bag: Bag } | { ok: false; reason: 'money' | 'owned' };

/** Buys one item. A rod is bought once. */
export function buy(money: number, bag: Bag, id: ItemId): BuyResult {
  const item = ITEMS[id];
  if (item.kind === 'rod' && countOf(bag, id) > 0) return { ok: false, reason: 'owned' };
  if (money < item.price) return { ok: false, reason: 'money' };
  return { ok: true, money: money - item.price, bag: addItem(bag, id) };
}

/** Trainers (the battle field) pay the sum of their Pokémon's levels × 20. Wild Pokémon pay nothing. */
export const PRIZE_PER_LEVEL = 20;
export const prizeMoney = (opponentLevels: readonly number[]) => opponentLevels.reduce((sum, level) => sum + level, 0) * PRIZE_PER_LEVEL;

/** Losing a battle: half the money is lost (rounded down). */
export const moneyAfterLoss = (money: number) => Math.floor(money / 2);

export const canUsePotion = (p: Pokemon) => p.hp > 0 && p.hp < maxHpOf(p);

/** Restores real HP (potions can't revive a fainted Pokémon, or go above max HP). */
export function usePotion(p: Pokemon, id: ItemId): Pokemon {
  const item = ITEMS[id];
  if (item.kind !== 'potion') throw new Error(`${id} is not a potion`);
  if (!canUsePotion(p)) throw new Error('This Pokémon cannot use a potion now');
  return { ...p, hp: Math.min(maxHpOf(p), p.hp + item.heal * HP_UNITS) };
}
