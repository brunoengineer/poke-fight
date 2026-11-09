// Kanto (plan.md §3 and §6), the first region: Red/Blue's cities, gyms, League and hunting grounds. Hunting grounds
// are the real Red/Blue location areas from the generated data (their names are PokeAPI's), grouped by kind:
//   - grass and cave: Pokémon found walking there;
//   - water: Pokémon fished there (with the best rod owned).
// The other regions are files like this one (see types.ts for what each part means).

import type { ItemId } from '../items';
import type { City, Gym, LeagueMember, Region, TeamSpec } from './types';

export type { City, Gym, HuntKind, LeagueMember } from './types';

const MART: ItemId[] = ['poke-ball', 'great-ball', 'potion', 'super-potion'];

const CITIES: City[] = [
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
    // No grass of its own (Route 9 only had Pokémon met before, decided after milestone 11): the Power Plant.
    hunts: { cave: ['kanto-power-plant-area'] },
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
const GYMS: Gym[] = [
  { badge: 'boulder', city: 'pewter', leader: 'Brock', type: 'rock', badges: 0, team: [['geodude', 12], ['onix', 14]], ai: { difficulty: 'normal', style: 'defensive' }, sprite: 'brock', badgeSprite: 1 },
  { badge: 'cascade', city: 'cerulean', leader: 'Misty', type: 'water', badges: 1, team: [['staryu', 18], ['starmie', 21]], ai: { difficulty: 'normal', style: 'zoner' }, sprite: 'misty', badgeSprite: 2 },
  { badge: 'thunder', city: 'vermilion', leader: 'Lt. Surge', type: 'electric', badges: 2, team: [['voltorb', 21], ['pikachu', 18], ['raichu', 24]], ai: { difficulty: 'normal', style: 'aggressive' }, sprite: 'ltsurge', badgeSprite: 3 },
  { badge: 'rainbow', city: 'celadon', leader: 'Erika', type: 'grass', badges: 3, team: [['victreebel', 29], ['tangela', 24], ['vileplume', 29]], ai: { difficulty: 'normal', style: 'defensive' }, sprite: 'erika', badgeSprite: 4 },
  { badge: 'soul', city: 'fuchsia', leader: 'Koga', type: 'poison', badges: 4, team: [['koffing', 37], ['muk', 39], ['koffing', 37], ['weezing', 43]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'koga', badgeSprite: 5 },
  { badge: 'marsh', city: 'saffron', leader: 'Sabrina', type: 'psychic', badges: 5, team: [['kadabra', 38], ['mr-mime', 37], ['venomoth', 38], ['alakazam', 43]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'sabrina', badgeSprite: 6 },
  { badge: 'volcano', city: 'cinnabar', leader: 'Blaine', type: 'fire', badges: 6, team: [['growlithe', 42], ['ponyta', 40], ['rapidash', 42], ['arcanine', 47]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'blaine', badgeSprite: 7 },
  { badge: 'earth', city: 'viridian', leader: 'Giovanni', type: 'ground', badges: 7, team: [['rhyhorn', 45], ['dugtrio', 42], ['nidoqueen', 44], ['nidoking', 45], ['rhydon', 50]], ai: { difficulty: 'hard', style: 'balanced' }, sprite: 'giovanni', badgeSprite: 8 },
];

/** The Elite Four, with their Red/Blue teams. */
const ELITE_FOUR: LeagueMember[] = [
  { id: 'lorelei', name: 'Lorelei', type: 'ice', team: [['dewgong', 54], ['cloyster', 53], ['slowbro', 54], ['jynx', 56], ['lapras', 56]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'lorelei-gen3' },
  { id: 'bruno', name: 'Bruno', type: 'fighting', team: [['onix', 53], ['hitmonchan', 55], ['hitmonlee', 55], ['onix', 56], ['machamp', 58]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'bruno' },
  { id: 'agatha', name: 'Agatha', type: 'ghost', team: [['gengar', 56], ['golbat', 56], ['haunter', 55], ['arbok', 58], ['gengar', 60]], ai: { difficulty: 'hard', style: 'defensive' }, sprite: 'agatha-gen3' },
  { id: 'lance', name: 'Lance', type: 'dragon', team: [['gyarados', 58], ['dragonair', 56], ['dragonair', 56], ['aerodactyl', 60], ['dragonite', 62]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'lance' },
];

/** The Champion is the rival: their Red/Blue team depends on the starter they took (by species id). */
const CHAMPION_TEAMS: Record<number, TeamSpec> = {
  7: [['pidgeot', 61], ['alakazam', 59], ['rhydon', 61], ['arcanine', 61], ['exeggutor', 63], ['blastoise', 65]],
  1: [['pidgeot', 61], ['alakazam', 59], ['rhydon', 61], ['gyarados', 61], ['arcanine', 63], ['venusaur', 65]],
  4: [['pidgeot', 61], ['alakazam', 59], ['rhydon', 61], ['exeggutor', 61], ['gyarados', 63], ['charizard', 65]],
};

export const KANTO: Region = {
  id: 'kanto',
  generation: 1,
  lastSpecies: 151,
  color: '#e8403a',
  cover: ['mewtwo', 'zapdos', 'articuno'],
  cities: CITIES,
  gyms: GYMS,
  league: { city: 'indigo', eliteFour: ELITE_FOUR, champion: { kind: 'rival', teams: CHAMPION_TEAMS, ai: { difficulty: 'hard', style: 'balanced' } } },
  // Bulbasaur, Charmander, Squirtle; the Professor teaches each its first type move; the rival takes the one that beats yours.
  starters: [1, 4, 7],
  starterGifts: { 1: 'vine-whip', 4: 'ember', 7: 'bubble' },
  rivalPick: { 1: 4, 4: 7, 7: 1 },
  people: { professor: 'oak', rival: 'blue' },
  training: ['rattata', 'pidgey', 'geodude'],
  art: {
    pallet: { backdrop: 'meadow', color: '#7ed68a' },
    viridian: { backdrop: 'route', color: '#4fbf6a' },
    pewter: { backdrop: 'mountain', color: '#c9a36a' },
    cerulean: { backdrop: 'river', color: '#4fa3ff' },
    vermilion: { backdrop: 'beach', color: '#ff9a3d' },
    lavender: { backdrop: 'dampcave', color: '#a879ff' },
    celadon: { backdrop: 'forest', color: '#62d17a' },
    fuchsia: { backdrop: 'beachshore', color: '#ff6fb5' },
    saffron: { backdrop: 'city', color: '#ffc94a' },
    cinnabar: { backdrop: 'volcanocave', color: '#ff5a4a' },
    indigo: { backdrop: 'spl', color: '#8f7bff' },
  },
  towns: {
    pallet: { ground: 'grass', row: ['house', 'lab', 'house'], water: ['seaBottom'], light: 'day', grass: '#78c850' },
    viridian: { ground: 'grass', row: ['house', 'center', 'mart', 'house', 'gym'], water: ['pond'], light: 'day', grass: '#5fb54a' },
    pewter: { ground: 'rock', row: ['house', 'museum', 'center', 'mart', 'gym'], water: [], light: 'day' },
    cerulean: { ground: 'grass', row: ['house', 'center', 'gym', 'mart'], water: ['river', 'pond'], light: 'day', grass: '#6cc55a' },
    vermilion: { ground: 'grass', row: ['center', 'mart', 'gym', 'house'], water: ['seaRight'], light: 'sunset', grass: '#7cc455' },
    lavender: { ground: 'grass', row: ['house', 'tower', 'center', 'mart'], water: [], light: 'dusk', grass: '#7aa86a' },
    celadon: { ground: 'grass', row: ['house', 'store', 'center', 'gym', 'tall'], water: ['pond'], light: 'day', grass: '#58b35a' },
    fuchsia: { ground: 'grass', row: ['gate', 'center', 'mart', 'gym'], water: ['pond'], light: 'day', grass: '#86c24a' },
    saffron: { ground: 'paved', row: ['tall', 'skyscraper', 'center', 'gym', 'mart', 'tall'], water: [], light: 'day' },
    cinnabar: { ground: 'sand', row: ['center', 'mart', 'gym', 'volcano'], water: ['seaBottom'], light: 'sunset' },
    indigo: { ground: 'grass', row: ['center', 'league', 'mart'], water: [], light: 'night', grass: '#5f9e5a' },
  },
  map: {
    // The mainland and Cinnabar Island (shapes made for this map, roughly Kanto's).
    land: 'M5 7 Q18 1 36 4 Q52 1 66 4 Q84 3 89 13 Q94 26 88 38 Q82 49 66 48 Q58 55 46 56 Q36 55 32 49 L18 49 Q8 46 8 32 Q3 18 5 7 Z',
    islands: [
      { x: 21, y: 55.5, r: 4.4 },
      { x: 33, y: 57.5, r: 1.2 },
      { x: 95, y: 44, r: 1.4 },
      { x: 3, y: 52, r: 1.6 },
    ],
    lakes: [{ x: 67, y: 9.5, rx: 4.2, ry: 2.2 }],
    rivers: [
      [
        [67, 9],
        [71, 7.5],
        [74, 6],
        [77, 4.5],
        [80, 3],
      ],
    ],
    // Mt. Moon, the Rock Tunnel, Victory Road and the plateau, a few hills.
    mountains: [
      [34, 11, 1.1],
      [38, 9.5, 1.3],
      [41.5, 11.5, 1],
      [36.5, 13, 0.8],
      [44, 10, 0.8],
      [70, 17, 1.2],
      [73.5, 19, 1],
      [67.5, 19.5, 0.8],
      [76, 16.5, 0.8],
      [11, 20, 1.2],
      [14, 22.5, 1],
      [8.5, 23.5, 0.9],
      [6.5, 14, 0.8],
      [16, 6.5, 0.9],
      [19, 8, 0.7],
      [84, 30, 0.8],
      [86.5, 33, 0.7],
    ],
    // Viridian Forest, the woods around the Safari Zone, groves along the routes.
    forests: [
      [17.5, 22, 5.5],
      [27, 20, 2.5],
      [47, 44, 4.5],
      [39, 47, 2.5],
      [80, 40, 3],
      [52, 18, 2.2],
      [12, 40, 3],
      [62, 36, 2],
    ],
    places: {
      indigo: { x: 11, y: 10 },
      pewter: { x: 24, y: 14 },
      viridian: { x: 22, y: 30 },
      pallet: { x: 22, y: 44 },
      cinnabar: { x: 21, y: 55.5 },
      cerulean: { x: 58, y: 11 },
      celadon: { x: 42, y: 28 },
      saffron: { x: 58, y: 28 },
      lavender: { x: 78, y: 28 },
      vermilion: { x: 58, y: 42 },
      fuchsia: { x: 45, y: 51 },
      'kanto-sanctuary': { x: 50, y: 37 },
    },
    routes: [
      ['pallet', 'viridian'],
      ['viridian', 'pewter'],
      ['viridian', 'indigo'],
      ['pewter', 'cerulean'],
      ['cerulean', 'saffron'],
      ['cerulean', 'lavender'],
      ['saffron', 'celadon'],
      ['saffron', 'lavender'],
      ['saffron', 'vermilion'],
      ['lavender', 'vermilion'],
      ['celadon', 'fuchsia'],
      ['vermilion', 'fuchsia'],
      ['fuchsia', 'cinnabar'],
      ['cinnabar', 'pallet'],
      ['saffron', 'kanto-sanctuary'],
    ],
  },
  sanctuary: {
    id: 'kanto-sanctuary',
    art: { backdrop: 'space', color: '#b388ff' },
    town: { ground: 'paved', row: ['tower', 'league', 'tower'], water: ['pond'], light: 'night' },
    shop: ['ultra-ball', 'hyper-potion', 'master-ball'],
    legendaries: [
      { species: 'articuno', level: 55, attacks: ['meteor', 'vortex', 'slash'], backdrop: 'icecave' },
      { species: 'zapdos', level: 55, attacks: ['meteor', 'rampage', 'nova'], backdrop: 'thunderplains' },
      { species: 'moltres', level: 55, attacks: ['nova', 'slash', 'meteor'], backdrop: 'volcanocave' },
      { species: 'mewtwo', level: 70, attacks: ['nova', 'vortex', 'slash', 'meteor'], backdrop: 'space' },
      { species: 'mew', level: 60, attacks: ['nova', 'meteor', 'vortex'], backdrop: 'space' },
    ],
  },
};
