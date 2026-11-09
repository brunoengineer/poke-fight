// The bag: what the player carries, sorted into pockets as in the games, and what each item can do to a Pokémon.
// Pure: the bag screen (ui/screens/bag.ts) shows it; the rules of each item live in economy.ts and progress.ts.

import { ITEMS, type ItemId } from '../data/items';
import { canUsePotion, countOf, type Bag } from './economy';
import type { Pokemon } from './pokemon';
import { itemEvolution } from './progress';

export type Pocket = 'medicine' | 'balls' | 'evolution' | 'key';

export const POCKETS: readonly Pocket[] = ['medicine', 'balls', 'evolution', 'key'];

export function pocketOf(id: ItemId): Pocket {
  switch (ITEMS[id].kind) {
    case 'potion':
      return 'medicine';
    case 'ball':
      return 'balls';
    case 'evolution':
      return 'evolution';
    case 'rod':
      return 'key';
  }
}

export interface BagPocket {
  pocket: Pocket;
  items: { id: ItemId; count: number }[];
}

/** The pockets that have something, in order, each with its items in the shop's order. */
export function bagContents(bag: Bag): BagPocket[] {
  const ids = (Object.keys(ITEMS) as ItemId[]).filter(id => countOf(bag, id) > 0);
  return POCKETS.map(pocket => ({ pocket, items: ids.filter(id => pocketOf(id) === pocket).map(id => ({ id, count: countOf(bag, id) })) })).filter(
    p => p.items.length > 0,
  );
}

/** Items used on a Pokémon from the bag (balls are thrown after a battle, rods fish: they are used elsewhere). */
export const usableFromBag = (id: ItemId) => ITEMS[id].kind === 'potion' || ITEMS[id].kind === 'evolution';

export type UseCheck = { ok: true } | { ok: false; reason: 'fainted' | 'fullHp' | 'noEffect' };

/**
 * Whether this item would do something to this Pokémon (and why not). `last`: the region's Pokédex ends there, and
 * nothing evolves past it (a Gen 4 evolution doesn't exist in Hoenn).
 */
export function checkUse(id: ItemId, pokemon: Pokemon, last = Infinity): UseCheck {
  const item = ITEMS[id];
  if (item.kind === 'potion') {
    if (canUsePotion(pokemon)) return { ok: true };
    return { ok: false, reason: pokemon.hp === 0 ? 'fainted' : 'fullHp' };
  }
  if (item.kind === 'evolution') {
    const evolution = itemEvolution(pokemon, id as Parameters<typeof itemEvolution>[1]);
    if (evolution && evolution.to <= last) return { ok: true };
    return { ok: false, reason: pokemon.hp === 0 && itemEvolution({ ...pokemon, hp: 1 }, id as Parameters<typeof itemEvolution>[1]) ? 'fainted' : 'noEffect' };
  }
  return { ok: false, reason: 'noEffect' };
}
