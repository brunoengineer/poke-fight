// Kanto, as menus (plan.md §3 and §6): each city's unlock rule, shop and hunting grounds. Hunting grounds are the real
// Red/Blue location areas from the generated data (their names are PokeAPI's), grouped by kind:
//   - grass and cave: Pokémon found walking there;
//   - water: Pokémon fished there (with the best rod owned; surfing comes later).
// A new region is a file like this one.

import type { Difficulty, Style } from '../../fight/ai/profiles';
import type { ItemId } from '../items';

export type HuntKind = 'grass' | 'water' | 'cave';

export interface City {
  id: string;
  /** Badges needed to travel there. */
  badges: number;
  /** What its Poké Mart sells (null: no shop). */
  shop: ItemId[] | null;
  hunts: Partial<Record<HuntKind, string[]>>;
  /** The Safari Zone's areas (Fuchsia only). */
  safari?: string[];
}

export interface Gym {
  /** The badge's id. */
  badge: string;
  city: string;
  leader: string;
  type: string;
  /** Badges needed to challenge it (on top of reaching the city): Viridian's gym is the last one. */
  badges: number;
  /** The leader's team, as in Red/Blue. */
  team: readonly (readonly [species: string, level: number])[];
  /** How the leader fights: a CPU difficulty and a style that suits the type. */
  ai: { difficulty: Difficulty; style: Style };
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
    safari: ['kanto-safari-zone-middle', 'kanto-safari-zone-area-1-east', 'kanto-safari-zone-area-2-north', 'kanto-safari-zone-area-3-west'],
  },
  {
    // The big mall (your idea in the plan): everything, including the Super Rod, the stones and the Link Cable.
    id: 'saffron',
    badges: 5,
    shop: [...MART, 'ultra-ball', 'hyper-potion', 'super-rod', 'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'link-cable'],
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

/** The 8 gyms, in the order the badges are meant to be won (leaders, badges and teams as in Red/Blue). */
export const GYMS: readonly Gym[] = [
  { badge: 'boulder', city: 'pewter', leader: 'Brock', type: 'rock', badges: 0, team: [['geodude', 12], ['onix', 14]], ai: { difficulty: 'normal', style: 'defensive' } },
  { badge: 'cascade', city: 'cerulean', leader: 'Misty', type: 'water', badges: 1, team: [['staryu', 18], ['starmie', 21]], ai: { difficulty: 'normal', style: 'zoner' } },
  { badge: 'thunder', city: 'vermilion', leader: 'Lt. Surge', type: 'electric', badges: 2, team: [['voltorb', 21], ['pikachu', 18], ['raichu', 24]], ai: { difficulty: 'normal', style: 'aggressive' } },
  { badge: 'rainbow', city: 'celadon', leader: 'Erika', type: 'grass', badges: 3, team: [['victreebel', 29], ['tangela', 24], ['vileplume', 29]], ai: { difficulty: 'normal', style: 'defensive' } },
  { badge: 'soul', city: 'fuchsia', leader: 'Koga', type: 'poison', badges: 4, team: [['koffing', 37], ['muk', 39], ['koffing', 37], ['weezing', 43]], ai: { difficulty: 'hard', style: 'zoner' } },
  { badge: 'marsh', city: 'saffron', leader: 'Sabrina', type: 'psychic', badges: 5, team: [['kadabra', 38], ['mr-mime', 37], ['venomoth', 38], ['alakazam', 43]], ai: { difficulty: 'hard', style: 'zoner' } },
  { badge: 'volcano', city: 'cinnabar', leader: 'Blaine', type: 'fire', badges: 6, team: [['growlithe', 42], ['ponyta', 40], ['rapidash', 42], ['arcanine', 47]], ai: { difficulty: 'hard', style: 'aggressive' } },
  { badge: 'earth', city: 'viridian', leader: 'Giovanni', type: 'ground', badges: 7, team: [['rhyhorn', 45], ['dugtrio', 42], ['nidoqueen', 44], ['nidoking', 45], ['rhydon', 50]], ai: { difficulty: 'hard', style: 'balanced' } },
];

export const gymIn = (cityId: string) => GYMS.find(g => g.city === cityId) ?? null;

export function city(id: string): City {
  const found = KANTO.find(c => c.id === id);
  if (!found) throw new Error(`Unknown city ${id}`);
  return found;
}

export const isUnlocked = (c: City, badges: number) => badges >= c.badges;
