// Hoenn, the third region: Ruby/Sapphire/Emerald's towns, gyms, League and hunting grounds (Emerald where they
// differ: Juan leads Sootopolis's gym and Wallace is the Champion). Hunting grounds are Emerald's location areas from
// the generated data (their names are PokeAPI's), grouped by kind as in kanto.ts:
//   - grass and cave: Pokémon found walking there;
//   - water: Pokémon fished there (with the best rod owned).
// Hoenn is mostly sea, so many towns fish more than they walk; each one leads with Pokémon of its own corner.

import type { ItemId } from '../items';
import type { City, Gym, LeagueMember, Region } from './types';

const MART: ItemId[] = ['poke-ball', 'great-ball', 'potion', 'super-potion'];
const LATE_MART: ItemId[] = [...MART, 'ultra-ball', 'hyper-potion'];

const CITIES: City[] = [
  {
    id: 'littleroot',
    badges: 0,
    shop: null,
    hunts: { grass: ['hoenn-route-101-area'] },
  },
  {
    id: 'oldale',
    badges: 0,
    shop: ['poke-ball', 'potion'],
    hunts: { grass: ['hoenn-route-103-area'], water: ['hoenn-route-103-area'] },
  },
  {
    id: 'petalburg',
    badges: 0,
    shop: ['poke-ball', 'potion', 'super-potion'],
    hunts: { grass: ['hoenn-route-102-area'], water: ['petalburg-city-area', 'hoenn-route-102-area'] },
  },
  {
    id: 'rustboro',
    badges: 0,
    shop: MART,
    hunts: { grass: ['petalburg-woods-area', 'hoenn-route-104-area', 'hoenn-route-116-area'] },
  },
  {
    // The Old Rod comes from Dewford's fisherman in the games.
    id: 'dewford',
    badges: 1,
    shop: [...MART, 'old-rod'],
    hunts: {
      water: ['dewford-town-area', 'hoenn-route-106-area', 'hoenn-route-107-area'],
      cave: ['granite-cave-1f', 'granite-cave-1fsmall-room', 'granite-cave-b1f', 'granite-cave-b2f'],
    },
  },
  {
    id: 'slateport',
    badges: 2,
    shop: MART,
    hunts: { grass: ['hoenn-route-110-area'], water: ['slateport-city-area', 'hoenn-route-109-area', 'abandoned-ship-area'] },
  },
  {
    // The Good Rod comes from the fisherman on Route 118, just east of Mauville.
    id: 'mauville',
    badges: 2,
    shop: [...MART, 'good-rod'],
    hunts: {
      grass: ['hoenn-route-111-area', 'mirage-tower-area'],
      water: ['hoenn-route-110-area', 'hoenn-route-111-area'],
      cave: ['new-mauville-entrance', 'new-mauville-area'],
    },
  },
  {
    id: 'verdanturf',
    badges: 2,
    shop: MART,
    hunts: { grass: ['hoenn-route-117-area'], water: ['hoenn-route-117-area'] },
  },
  {
    id: 'fallarbor',
    badges: 3,
    shop: MART,
    hunts: {
      grass: ['hoenn-route-113-area', 'hoenn-route-114-area', 'hoenn-route-115-area'],
      water: ['hoenn-route-114-area', 'meteor-falls-area'],
      cave: ['meteor-falls-area'],
    },
  },
  {
    id: 'lavaridge',
    badges: 3,
    shop: MART,
    hunts: { grass: ['hoenn-route-112-area', 'jagged-pass-area'], cave: ['fiery-path-area', 'magma-hideout-area'] },
  },
  {
    id: 'fortree',
    badges: 5,
    shop: [...MART, 'ultra-ball'],
    hunts: { grass: ['hoenn-route-119-area', 'hoenn-route-118-area'], water: ['hoenn-route-118-area', 'hoenn-route-119-area'] },
  },
  {
    // The Department Store: everything, including the Super Rod, the stones, the Link Cable and the Soothe Bell. The
    // Safari Zone is on Route 121, just west of town (with Emerald's expansion of Johto Pokémon).
    id: 'lilycove',
    badges: 6,
    shop: [
      ...LATE_MART,
      'super-rod',
      'fire-stone',
      'water-stone',
      'thunder-stone',
      'leaf-stone',
      'moon-stone',
      'sun-stone',
      'link-cable',
      'soothe-bell',
    ],
    hunts: {
      grass: ['hoenn-route-120-area', 'hoenn-route-121-area'],
      water: ['lilycove-city-area', 'hoenn-route-121-area'],
      cave: ['mt-pyre-1f', 'mt-pyre-outside', 'mt-pyre-summit'],
    },
    safari: [
      'hoenn-safari-zone-sw',
      'hoenn-safari-zone-se',
      'hoenn-safari-zone-nwmach-bike-area',
      'hoenn-safari-zone-neacro-bike-area',
      'hoenn-safari-zone-expansion-north',
      'hoenn-safari-zone-expansion-south',
    ],
  },
  {
    id: 'mossdeep',
    badges: 6,
    shop: LATE_MART,
    hunts: {
      water: ['mossdeep-city-area', 'hoenn-route-124-area', 'hoenn-route-125-area'],
      cave: ['shoal-cave-low-tide', 'shoal-cave-high-tide', 'shoal-cave-b3f'],
    },
  },
  {
    id: 'sootopolis',
    badges: 7,
    shop: LATE_MART,
    hunts: { water: ['sootopolis-city-area', 'hoenn-route-126-area'], cave: ['cave-of-origin-1f', 'cave-of-origin-b1f', 'seafloor-cavern-area'] },
  },
  {
    // Mirage Island (Wynaut) and the Sky Pillar are out in Pacifidlog's sea.
    id: 'pacifidlog',
    badges: 7,
    shop: LATE_MART,
    hunts: {
      grass: ['mirage-island-area'],
      water: ['pacifidlog-town-area', 'hoenn-route-132-area', 'hoenn-route-133-area'],
      cave: ['sky-pillar-1f', 'sky-pillar-3f', 'sky-pillar-5f'],
    },
  },
  {
    // Meteor Falls' deepest room (Bagon) needs Waterfall, the last HM, in the games: it opens with the League's city.
    // The Artisan Cave (Smeargle) is out at the Battle Frontier, reached after the League.
    id: 'ever-grande',
    badges: 8,
    shop: LATE_MART,
    hunts: {
      water: ['ever-grande-city-area', 'hoenn-route-128-area'],
      cave: ['hoenn-victory-road-1f', 'hoenn-victory-road-b1f', 'hoenn-victory-road-b2f', 'meteor-falls-backsmall-room', 'artisan-cave-area'],
    },
  },
];

/** The 8 gyms, in the order the badges are meant to be won (leaders, badges and teams as in Emerald). */
const GYMS: Gym[] = [
  { badge: 'stone', city: 'rustboro', leader: 'Roxanne', type: 'rock', badges: 0, team: [['geodude', 12], ['geodude', 12], ['nosepass', 15]], ai: { difficulty: 'normal', style: 'defensive' }, sprite: 'roxanne', badgeSprite: 17 },
  { badge: 'knuckle', city: 'dewford', leader: 'Brawly', type: 'fighting', badges: 1, team: [['machop', 16], ['meditite', 16], ['makuhita', 19]], ai: { difficulty: 'normal', style: 'aggressive' }, sprite: 'brawly', badgeSprite: 18 },
  { badge: 'dynamo', city: 'mauville', leader: 'Wattson', type: 'electric', badges: 2, team: [['voltorb', 20], ['electrike', 20], ['magneton', 22], ['manectric', 24]], ai: { difficulty: 'normal', style: 'aggressive' }, sprite: 'wattson', badgeSprite: 19 },
  { badge: 'heat', city: 'lavaridge', leader: 'Flannery', type: 'fire', badges: 3, team: [['numel', 24], ['slugma', 24], ['camerupt', 26], ['torkoal', 29]], ai: { difficulty: 'normal', style: 'aggressive' }, sprite: 'flannery', badgeSprite: 20 },
  // Norman, the player's father in the games, waits in Petalburg until four badges are won.
  { badge: 'balance', city: 'petalburg', leader: 'Norman', type: 'normal', badges: 4, team: [['spinda', 27], ['vigoroth', 27], ['linoone', 29], ['slaking', 31]], ai: { difficulty: 'hard', style: 'balanced' }, sprite: 'norman', badgeSprite: 21 },
  { badge: 'feather', city: 'fortree', leader: 'Winona', type: 'flying', badges: 5, team: [['swablu', 29], ['tropius', 29], ['pelipper', 30], ['skarmory', 31], ['altaria', 33]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'winona', badgeSprite: 22 },
  { badge: 'mind', city: 'mossdeep', leader: 'Tate & Liza', type: 'psychic', badges: 6, team: [['claydol', 41], ['xatu', 41], ['lunatone', 42], ['solrock', 42]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'tateandliza-gen3', badgeSprite: 23 },
  { badge: 'rain', city: 'sootopolis', leader: 'Juan', type: 'water', badges: 7, team: [['luvdisc', 41], ['whiscash', 41], ['sealeo', 43], ['crawdaunt', 43], ['kingdra', 46]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'juan', badgeSprite: 24 },
];

/** The Elite Four, with their Emerald teams (first challenge). */
const ELITE_FOUR: LeagueMember[] = [
  { id: 'sidney', name: 'Sidney', type: 'dark', team: [['mightyena', 46], ['cacturne', 46], ['shiftry', 48], ['crawdaunt', 48], ['absol', 49]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'sidney' },
  { id: 'phoebe', name: 'Phoebe', type: 'ghost', team: [['dusclops', 48], ['banette', 49], ['sableye', 50], ['banette', 49], ['dusclops', 51]], ai: { difficulty: 'hard', style: 'defensive' }, sprite: 'phoebe-gen3' },
  { id: 'glacia', name: 'Glacia', type: 'ice', team: [['sealeo', 50], ['glalie', 50], ['sealeo', 52], ['glalie', 52], ['walrein', 53]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'glacia' },
  { id: 'drake', name: 'Drake', type: 'dragon', team: [['shelgon', 52], ['altaria', 54], ['kingdra', 53], ['flygon', 53], ['salamence', 55]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'drake-gen3' },
];

/** Emerald's Champion: Wallace, the former Sootopolis Gym Leader, and his water Pokémon. */
const CHAMPION: LeagueMember = {
  id: 'wallace',
  name: 'Wallace',
  type: null,
  team: [['wailord', 57], ['tentacruel', 55], ['ludicolo', 56], ['whiscash', 56], ['gyarados', 56], ['milotic', 58]],
  ai: { difficulty: 'hard', style: 'balanced' },
  sprite: 'wallace',
};

export const HOENN: Region = {
  id: 'hoenn',
  generation: 3,
  lastSpecies: 386,
  color: '#2fbf71',
  cities: CITIES,
  gyms: GYMS,
  league: { city: 'ever-grande', eliteFour: ELITE_FOUR, champion: { kind: 'member', ...CHAMPION } },
  // Treecko, Torchic, Mudkip. Treecko's own first grass move is Absorb (power 20); Mega Drain (40) matches the others'
  // Ember and Water Gun. The rival takes the one that beats yours, as May and Brendan do.
  starters: [252, 255, 258],
  starterGifts: { 252: 'mega-drain', 255: 'ember', 258: 'water-gun' },
  rivalPick: { 252: 255, 255: 258, 258: 252 },
  people: { professor: 'birch', rival: 'may' },
  training: ['zigzagoon', 'poochyena', 'wurmple'],
  art: {
    littleroot: { backdrop: 'meadow', color: '#8ad66e' },
    oldale: { backdrop: 'route', color: '#6cc76a' },
    petalburg: { backdrop: 'river', color: '#4fbf9a' },
    rustboro: { backdrop: 'city', color: '#c98f5a' },
    dewford: { backdrop: 'beach', color: '#ffb35a' },
    slateport: { backdrop: 'beachshore', color: '#4fb8ff' },
    mauville: { backdrop: 'thunderplains', color: '#ffd84a' },
    verdanturf: { backdrop: 'meadow', color: '#5ad18f' },
    fallarbor: { backdrop: 'desert', color: '#b8a888' },
    lavaridge: { backdrop: 'volcanocave', color: '#ff6a3d' },
    fortree: { backdrop: 'forest', color: '#3fae5a' },
    lilycove: { backdrop: 'beachshore', color: '#ff8fb0' },
    mossdeep: { backdrop: 'space', color: '#7f8cff' },
    sootopolis: { backdrop: 'river', color: '#2fd0c8' },
    pacifidlog: { backdrop: 'deepsea', color: '#2f8fd8' },
    'ever-grande': { backdrop: 'spl', color: '#9f7bff' },
  },
  towns: {
    littleroot: { ground: 'grass', row: ['house', 'lab', 'house'], water: [], light: 'day', grass: '#7cd05a' },
    oldale: { ground: 'grass', row: ['house', 'center', 'mart', 'house'], water: [], light: 'day', grass: '#72c656' },
    petalburg: { ground: 'grass', row: ['house', 'gym', 'center', 'mart'], water: ['pond'], light: 'day', grass: '#64bc58' },
    // Devon Corporation's tower over a stone-paved city.
    rustboro: { ground: 'paved', row: ['house', 'skyscraper', 'center', 'gym', 'mart'], water: [], light: 'day' },
    dewford: { ground: 'sand', row: ['house', 'gym', 'center', 'mart'], water: ['seaBottom', 'seaRight'], light: 'day' },
    // The Oceanic Museum and the market by the harbor.
    slateport: { ground: 'sand', row: ['museum', 'center', 'mart', 'tall', 'house'], water: ['seaBottom'], light: 'day' },
    // A city under one roof: Mauville's big building.
    mauville: { ground: 'paved', row: ['tall', 'store', 'gym', 'center', 'mart'], water: [], light: 'day' },
    // The Contest Hall in a breezy green town.
    verdanturf: { ground: 'grass', row: ['house', 'tall', 'center', 'mart', 'house'], water: ['pond'], light: 'day', grass: '#5fc86a' },
    // Volcanic ash falls on Fallarbor's fields.
    fallarbor: { ground: 'grass', row: ['house', 'center', 'mart', 'house', 'museum'], water: [], light: 'sunset', grass: '#a4a878' },
    // Hot springs at the foot of Mt. Chimney.
    lavaridge: { ground: 'rock', row: ['center', 'mart', 'gym', 'volcano'], water: ['pond'], light: 'sunset' },
    fortree: { ground: 'grass', row: ['house', 'center', 'gym', 'mart', 'house'], water: [], light: 'day', grass: '#3f9e48' },
    // The Department Store, the Contest Hall and the museum by the sea.
    lilycove: { ground: 'grass', row: ['store', 'center', 'museum', 'mart'], water: ['seaBottom'], light: 'sunset', grass: '#78c460' },
    // The Space Center's rocket tower.
    mossdeep: { ground: 'sand', row: ['tower', 'center', 'gym', 'mart', 'house'], water: ['seaRight', 'seaBottom'], light: 'day' },
    // Inside a crater, around its lake.
    sootopolis: { ground: 'rock', row: ['house', 'gym', 'center', 'mart', 'house'], water: ['pond', 'river'], light: 'dusk' },
    // Houses on floating logs.
    pacifidlog: { ground: 'sand', row: ['house', 'center', 'house', 'house'], water: ['seaBottom', 'seaRight'], light: 'sunset' },
    'ever-grande': { ground: 'grass', row: ['center', 'league', 'mart'], water: ['river'], light: 'night', grass: '#4fa86a' },
  },
  map: {
    // The mainland (west and north) and the islands of the eastern sea (shapes made for this map, roughly Hoenn's).
    land: 'M3 7 Q10 2 22 3 Q36 1 50 3 Q62 1 70 5 Q77 9 75 16 Q73 23 66 27 Q61 31 57 34 Q51 38 46 41 Q42 45 42 49 Q34 53 26 50.5 Q17 52 12 48 Q4 45 4 35 Q2 21 3 7 Z',
    islands: [
      // Dewford, Mossdeep, Sootopolis's crater, Ever Grande, Pacifidlog.
      { x: 8, y: 55, r: 3 },
      { x: 85, y: 16, r: 4.6 },
      { x: 78, y: 33, r: 4.4 },
      { x: 92, y: 46, r: 5 },
      { x: 56, y: 54, r: 1.7 },
      // Mt. Pyre, the Sky Pillar, the Battle Frontier, the Shoal Cave, the Southern Island, the Abandoned Ship's reef.
      { x: 68, y: 36.5, r: 2 },
      { x: 46, y: 56, r: 1.4 },
      { x: 66, y: 45, r: 2.2 },
      { x: 92, y: 9, r: 1.5 },
      { x: 74, y: 55, r: 1.2 },
      { x: 17, y: 57.5, r: 0.9 },
    ],
    lakes: [
      { x: 79.5, y: 31.5, rx: 2.2, ry: 1.4 },
      { x: 58, y: 18, rx: 1.8, ry: 1.1 },
    ],
    rivers: [
      // Route 119's river, from the Weather Institute's hills down to the sea.
      [
        [54, 6],
        [55, 11],
        [57, 16],
        [58, 18],
        [59, 23],
        [61, 28],
        [62, 30],
      ],
    ],
    // Mt. Chimney and the Jagged Pass, Meteor Falls, Mt. Pyre, Granite Cave, Victory Road, the crater's rim.
    mountains: [
      [30, 15, 1.3],
      [33.5, 17, 1.1],
      [27, 16.5, 1],
      [36, 13.5, 0.8],
      [24, 14, 0.8],
      [31, 11, 0.8],
      [11, 16, 1.1],
      [8.5, 17.5, 0.8],
      [14, 18, 0.7],
      [68, 36.5, 0.9],
      [6.5, 54.5, 0.7],
      [90, 43, 0.9],
      [94, 42, 0.8],
      [76, 30, 0.7],
      [80.5, 35, 0.6],
    ],
    // Petalburg Woods, Route 119's jungle, Fortree's forest, Route 120, the Safari Zone, Route 117, Route 101.
    forests: [
      [9.5, 32, 3.5],
      [50, 17, 4],
      [46, 6, 3],
      [60, 11, 2.5],
      [66, 13, 2.2],
      [30, 33, 2.2],
      [18, 45, 1.6],
      [41, 25, 2],
    ],
    places: {
      littleroot: { x: 22, y: 46 },
      oldale: { x: 22, y: 40 },
      petalburg: { x: 11, y: 40 },
      rustboro: { x: 8, y: 25 },
      dewford: { x: 9, y: 55 },
      slateport: { x: 36, y: 47 },
      mauville: { x: 36, y: 33 },
      verdanturf: { x: 23, y: 31 },
      fallarbor: { x: 16, y: 9 },
      lavaridge: { x: 26, y: 22 },
      fortree: { x: 50, y: 9 },
      lilycove: { x: 70, y: 15 },
      mossdeep: { x: 85, y: 17 },
      sootopolis: { x: 77.5, y: 34 },
      pacifidlog: { x: 56, y: 54 },
      'ever-grande': { x: 92, y: 47 },
      'hoenn-sanctuary': { x: 48, y: 28 },
    },
    routes: [
      ['littleroot', 'oldale'],
      ['oldale', 'petalburg'],
      ['petalburg', 'rustboro'],
      ['petalburg', 'dewford'],
      ['dewford', 'slateport'],
      ['slateport', 'mauville'],
      ['mauville', 'verdanturf'],
      ['verdanturf', 'rustboro'],
      ['rustboro', 'fallarbor'],
      ['mauville', 'lavaridge'],
      ['fallarbor', 'lavaridge'],
      ['mauville', 'fortree'],
      ['fortree', 'lilycove'],
      ['lilycove', 'mossdeep'],
      ['mossdeep', 'sootopolis'],
      ['sootopolis', 'ever-grande'],
      ['slateport', 'pacifidlog'],
      ['pacifidlog', 'ever-grande'],
      ['mauville', 'hoenn-sanctuary'],
    ],
  },
  sanctuary: {
    id: 'hoenn-sanctuary',
    art: { backdrop: 'space', color: '#4fd1a5' },
    // Land and sea meet: Groudon's volcano, Kyogre's water, Rayquaza's pillar.
    town: { ground: 'rock', row: ['volcano', 'tower', 'league', 'tower'], water: ['seaBottom'], light: 'night' },
    shop: ['ultra-ball', 'hyper-potion', 'master-ball'],
    // Boss attacks are slash, nova and meteor for now. When more land, these would suit better: `quake` for Groudon
    // and Regirock, `vortex` for Kyogre (its whirlpool), `rampage` for Registeel and Latios.
    legendaries: [
      { species: 'regirock', level: 55, attacks: ['quake', 'slash', 'rampage'], backdrop: 'desert' },
      { species: 'regice', level: 55, attacks: ['nova', 'meteor', 'quake'], backdrop: 'icecave' },
      { species: 'registeel', level: 55, attacks: ['rampage', 'slash', 'quake'], backdrop: 'earthycave' },
      { species: 'latias', level: 58, attacks: ['nova', 'meteor', 'vortex'], backdrop: 'beachshore' },
      { species: 'latios', level: 58, attacks: ['rampage', 'slash', 'nova'], backdrop: 'beach' },
      { species: 'groudon', level: 70, attacks: ['quake', 'meteor', 'slash'], backdrop: 'volcanocave' },
      { species: 'kyogre', level: 70, attacks: ['vortex', 'nova', 'slash'], backdrop: 'deepsea' },
      { species: 'rayquaza', level: 72, attacks: ['meteor', 'rampage', 'slash'], backdrop: 'space' },
      { species: 'jirachi', level: 60, attacks: ['meteor', 'nova', 'vortex'], backdrop: 'meadow' },
      { species: 'deoxys', level: 65, attacks: ['nova', 'rampage', 'meteor'], backdrop: 'space' },
    ],
  },
};
