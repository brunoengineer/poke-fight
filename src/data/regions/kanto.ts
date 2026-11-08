// Kanto, as menus (plan.md §3 and §6): each city's unlock rule, shop and hunting grounds. Hunting grounds are the real
// Red/Blue location areas from the generated data (their names are PokeAPI's), grouped by kind:
//   - grass and cave: Pokémon found walking there;
//   - water: Pokémon fished there (with the best rod owned; surfing comes later).
// A new region is a file like this one.

import type { ItemId } from '../items';

export type HuntKind = 'grass' | 'water' | 'cave';

export interface City {
  id: string;
  /** Badges needed to travel there (gyms: milestone 8). */
  badges: number;
  /** What its Poké Mart sells (null: no shop). */
  shop: ItemId[] | null;
  hunts: Partial<Record<HuntKind, string[]>>;
}

const MART: ItemId[] = ['poke-ball', 'great-ball', 'potion', 'super-potion'];

export const KANTO: readonly City[] = [
  {
    id: 'pallet',
    badges: 0,
    shop: null,
    hunts: { grass: ['kanto-route-1-area'], water: ['pallet-town-area', 'kanto-sea-route-21-area'] },
  },
  {
    id: 'viridian',
    badges: 0,
    shop: ['poke-ball', 'potion', 'old-rod'],
    hunts: {
      grass: ['kanto-route-2-south-towards-viridian-city', 'kanto-route-22-area'],
      water: ['viridian-city-area', 'kanto-route-22-area'],
    },
  },
  {
    id: 'pewter',
    badges: 0,
    shop: ['poke-ball', 'potion', 'super-potion', 'good-rod'],
    hunts: { grass: ['viridian-forest-area', 'kanto-route-3-area'], cave: ['mt-moon-1f', 'mt-moon-b1f', 'mt-moon-b2f'] },
  },
  {
    id: 'cerulean',
    badges: 1,
    shop: MART,
    hunts: {
      grass: ['kanto-route-4-area', 'kanto-route-24-area', 'kanto-route-25-area'],
      water: ['cerulean-city-area', 'kanto-route-24-area', 'kanto-route-25-area'],
    },
  },
  {
    id: 'vermilion',
    badges: 2,
    shop: MART,
    hunts: {
      grass: ['kanto-route-5-area', 'kanto-route-6-area', 'kanto-route-11-area'],
      water: ['vermilion-city-area', 'kanto-route-6-area', 'kanto-route-11-area'],
      cave: ['digletts-cave-area'],
    },
  },
  {
    id: 'lavender',
    badges: 3,
    shop: MART,
    hunts: {
      grass: ['kanto-route-8-area', 'kanto-route-10-area', 'kanto-route-12-area'],
      water: ['kanto-route-10-area', 'kanto-route-12-area'],
      cave: ['rock-tunnel-b1f', 'rock-tunnel-b2f', 'pokemon-tower-3f', 'pokemon-tower-4f', 'pokemon-tower-5f', 'pokemon-tower-6f', 'pokemon-tower-7f'],
    },
  },
  {
    id: 'celadon',
    badges: 3,
    shop: MART,
    hunts: { grass: ['kanto-route-7-area', 'kanto-route-16-area'], water: ['celadon-city-area'] },
  },
  {
    id: 'fuchsia',
    badges: 4,
    shop: [...MART, 'ultra-ball'],
    hunts: {
      grass: ['kanto-route-13-area', 'kanto-route-14-area', 'kanto-route-15-area', 'kanto-route-18-area'],
      water: ['fuchsia-city-area', 'kanto-route-13-area', 'kanto-route-18-area'],
    },
  },
  {
    // The big mall (your idea in the plan): everything, including the Super Rod.
    id: 'saffron',
    badges: 5,
    shop: [...MART, 'ultra-ball', 'hyper-potion', 'super-rod'],
    hunts: { grass: ['kanto-route-9-area'], cave: ['kanto-power-plant-area'] },
  },
  {
    id: 'cinnabar',
    badges: 6,
    shop: [...MART, 'ultra-ball', 'hyper-potion'],
    hunts: {
      water: ['cinnabar-island-area', 'kanto-sea-route-19-area', 'kanto-sea-route-20-area'],
      cave: ['pokemon-mansion-1f', 'pokemon-mansion-2f', 'pokemon-mansion-3f', 'pokemon-mansion-b1f', 'seafoam-islands-1f', 'seafoam-islands-b1f'],
    },
  },
  {
    id: 'indigo',
    badges: 8,
    shop: [...MART, 'ultra-ball', 'hyper-potion'],
    hunts: {
      grass: ['kanto-route-23-area'],
      water: ['kanto-route-23-area'],
      cave: ['kanto-victory-road-2-1f', 'kanto-victory-road-2-2f', 'kanto-victory-road-2-3f'],
    },
  },
];

export function city(id: string): City {
  const found = KANTO.find(c => c.id === id);
  if (!found) throw new Error(`Unknown city ${id}`);
  return found;
}

export const isUnlocked = (c: City, badges: number) => badges >= c.badges;
