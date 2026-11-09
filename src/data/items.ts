// Items the player can buy and use. Prices follow the games where there is one; rods are bought here (decided after
// milestone 6: "we need to buy it somehow"). Names are translated (src/i18n: item.<id>).

export type BallId = 'poke-ball' | 'great-ball' | 'ultra-ball' | 'master-ball' | 'safari-ball';
export type PotionId = 'potion' | 'super-potion' | 'hyper-potion';
export type RodId = 'old-rod' | 'good-rod' | 'super-rod';
export type StoneId =
  | 'fire-stone'
  | 'water-stone'
  | 'thunder-stone'
  | 'leaf-stone'
  | 'moon-stone'
  | 'sun-stone'
  | 'dusk-stone'
  | 'shiny-stone'
  | 'dawn-stone';
/** Evolves Pokémon that evolve by trading, holding an item or not (decided default: an item, sold at the mall). */
export type CableId = 'link-cable';
/** Evolves Pokémon that evolve by friendship in the games (decided with generations 2–4: an item). */
export type BellId = 'soothe-bell';
export type EvolutionItemId = StoneId | CableId | BellId;
export type ItemId = BallId | PotionId | RodId | EvolutionItemId;

export type Item =
  | { id: BallId; kind: 'ball'; price: number; /** Catch multiplier; Infinity = always catches. */ bonus: number }
  | { id: PotionId; kind: 'potion'; price: number; /** Real HP restored. */ heal: number }
  | { id: RodId; kind: 'rod'; price: number }
  | { id: EvolutionItemId; kind: 'evolution'; price: number };

export const ITEMS: Record<ItemId, Item> = {
  'poke-ball': { id: 'poke-ball', kind: 'ball', price: 200, bonus: 1 },
  'great-ball': { id: 'great-ball', kind: 'ball', price: 600, bonus: 1.5 },
  'ultra-ball': { id: 'ultra-ball', kind: 'ball', price: 1200, bonus: 2 },
  // Sold only at the Legends' Sanctuaries (the only ball that can catch a legendary): expensive on purpose.
  'master-ball': { id: 'master-ball', kind: 'ball', price: 30000, bonus: Infinity },
  // Only inside the Safari Zone (never in the bag: the Safari Game hands out 30).
  'safari-ball': { id: 'safari-ball', kind: 'ball', price: 0, bonus: 1.5 },
  potion: { id: 'potion', kind: 'potion', price: 300, heal: 20 },
  'super-potion': { id: 'super-potion', kind: 'potion', price: 700, heal: 50 },
  'hyper-potion': { id: 'hyper-potion', kind: 'potion', price: 1500, heal: 200 },
  'old-rod': { id: 'old-rod', kind: 'rod', price: 1000 },
  'good-rod': { id: 'good-rod', kind: 'rod', price: 3000 },
  'super-rod': { id: 'super-rod', kind: 'rod', price: 10000 },
  'fire-stone': { id: 'fire-stone', kind: 'evolution', price: 2100 },
  'water-stone': { id: 'water-stone', kind: 'evolution', price: 2100 },
  'thunder-stone': { id: 'thunder-stone', kind: 'evolution', price: 2100 },
  'leaf-stone': { id: 'leaf-stone', kind: 'evolution', price: 2100 },
  'moon-stone': { id: 'moon-stone', kind: 'evolution', price: 2100 },
  'sun-stone': { id: 'sun-stone', kind: 'evolution', price: 2100 },
  'dusk-stone': { id: 'dusk-stone', kind: 'evolution', price: 2100 },
  'shiny-stone': { id: 'shiny-stone', kind: 'evolution', price: 2100 },
  'dawn-stone': { id: 'dawn-stone', kind: 'evolution', price: 2100 },
  'link-cable': { id: 'link-cable', kind: 'evolution', price: 2100 },
  'soothe-bell': { id: 'soothe-bell', kind: 'evolution', price: 3000 },
};

export const isItemId = (id: string): id is ItemId => Object.hasOwn(ITEMS, id);

/** Balls in the order they are offered after a battle (cheapest first). */
export const BALLS: readonly BallId[] = ['poke-ball', 'great-ball', 'ultra-ball', 'master-ball'];

export const EVOLUTION_ITEMS: readonly EvolutionItemId[] = [
  'fire-stone',
  'water-stone',
  'thunder-stone',
  'leaf-stone',
  'moon-stone',
  'sun-stone',
  'dusk-stone',
  'shiny-stone',
  'dawn-stone',
  'link-cable',
  'soothe-bell',
];

/** Better rods fish better Pokémon; the best one owned is used. */
export const RODS: readonly RodId[] = ['old-rod', 'good-rod', 'super-rod'];
