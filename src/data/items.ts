// Items the player can buy and use. Prices follow the games where there is one; rods are bought here (decided after
// milestone 6: "we need to buy it somehow"). Names are translated (src/i18n: item.<id>).

export type BallId = 'poke-ball' | 'great-ball' | 'ultra-ball' | 'master-ball';
export type PotionId = 'potion' | 'super-potion' | 'hyper-potion';
export type RodId = 'old-rod' | 'good-rod' | 'super-rod';
export type ItemId = BallId | PotionId | RodId;

export type Item =
  | { id: BallId; kind: 'ball'; price: number; /** Catch multiplier; Infinity = always catches. */ bonus: number }
  | { id: PotionId; kind: 'potion'; price: number; /** Real HP restored. */ heal: number }
  | { id: RodId; kind: 'rod'; price: number };

export const ITEMS: Record<ItemId, Item> = {
  'poke-ball': { id: 'poke-ball', kind: 'ball', price: 200, bonus: 1 },
  'great-ball': { id: 'great-ball', kind: 'ball', price: 600, bonus: 1.5 },
  'ultra-ball': { id: 'ultra-ball', kind: 'ball', price: 1200, bonus: 2 },
  'master-ball': { id: 'master-ball', kind: 'ball', price: 0, bonus: Infinity },
  potion: { id: 'potion', kind: 'potion', price: 300, heal: 20 },
  'super-potion': { id: 'super-potion', kind: 'potion', price: 700, heal: 50 },
  'hyper-potion': { id: 'hyper-potion', kind: 'potion', price: 1500, heal: 200 },
  'old-rod': { id: 'old-rod', kind: 'rod', price: 1000 },
  'good-rod': { id: 'good-rod', kind: 'rod', price: 3000 },
  'super-rod': { id: 'super-rod', kind: 'rod', price: 10000 },
};

export const isItemId = (id: string): id is ItemId => Object.hasOwn(ITEMS, id);

/** Balls in the order they are offered after a battle (cheapest first). */
export const BALLS: readonly BallId[] = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'];

/** Better rods fish better Pokémon; the best one owned is used. */
export const RODS: readonly RodId[] = ['old-rod', 'good-rod', 'super-rod'];
