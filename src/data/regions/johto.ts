// Johto, the second region: HeartGold/SoulSilver's cities, gyms, League and hunting grounds (Gold/Silver/Crystal for
// what HGSS left as it was). Hunting grounds are HGSS location areas from the generated data (PokeAPI's names), grouped
// by kind like Kanto's (grass and cave: walking; water: fishing with the best rod owned). See types.ts for each part.

import type { ItemId } from '../items';
import type { City, Gym, LeagueMember, Region } from './types';

const MART: ItemId[] = ['poke-ball', 'great-ball', 'potion', 'super-potion'];

const CITIES: City[] = [
  {
    id: 'new-bark',
    badges: 0,
    shop: null,
    hunts: { grass: ['johto-route-29-area', 'johto-route-46-area'], water: ['new-bark-town-area'] },
  },
  {
    // Johto's first Poké Mart sells the Old Rod (Kanto's pattern: the first shop).
    id: 'cherrygrove',
    badges: 0,
    shop: ['poke-ball', 'potion', 'old-rod'],
    hunts: { grass: ['johto-route-30-area'], water: ['cherrygrove-city-area', 'johto-route-30-area'] },
  },
  {
    id: 'violet',
    badges: 0,
    shop: ['poke-ball', 'potion', 'super-potion'],
    hunts: {
      grass: ['johto-route-31-area', 'johto-route-32-area'],
      water: ['violet-city-area', 'johto-route-32-area'],
      // Sprout Tower, the Dark Cave's mouth (Dunsparce) and the Ruins of Alph (Unown).
      cave: ['sprout-tower-2f', 'sprout-tower-3f', 'dark-cave-violet-city-entrance', 'ruins-of-alph-interior-a'],
    },
  },
  {
    id: 'azalea',
    badges: 1,
    shop: MART,
    hunts: {
      grass: ['ilex-forest-area', 'johto-route-33-area'],
      water: ['ilex-forest-area', 'slowpoke-well-1f'],
      cave: ['union-cave-1f', 'union-cave-b1f', 'slowpoke-well-1f'],
    },
  },
  {
    // The Department Store: the region's big store, with the stones, the Link Cable and the Soothe Bell (Johto's
    // friendship evolutions). Not the Super Rod: in HGSS it hooks Lv. 40 Pokémon everywhere, far too strong with two
    // badges, so Blackthorn sells it.
    id: 'goldenrod',
    badges: 2,
    shop: [...MART, 'fire-stone', 'water-stone', 'thunder-stone', 'leaf-stone', 'moon-stone', 'sun-stone', 'link-cable', 'soothe-bell'],
    hunts: {
      grass: ['johto-route-34-area', 'johto-route-35-area', 'national-park-area'],
      water: ['johto-route-34-area', 'johto-route-35-area'],
    },
  },
  {
    id: 'ecruteak',
    badges: 3,
    shop: MART,
    hunts: {
      grass: ['johto-route-36-area', 'johto-route-37-area', 'ruins-of-alph-outside'],
      water: ['ecruteak-city-area'],
      cave: ['burned-tower-1f', 'burned-tower-b1f'],
    },
  },
  {
    // The Good Rod comes from Olivine in the games too.
    id: 'olivine',
    badges: 4,
    shop: [...MART, 'ultra-ball', 'good-rod'],
    hunts: {
      grass: ['johto-route-38-area', 'johto-route-39-area'],
      water: ['olivine-city-area', 'johto-sea-route-40-area'],
    },
  },
  {
    id: 'cianwood',
    badges: 4,
    shop: [...MART, 'ultra-ball'],
    hunts: {
      grass: ['johto-route-48-area'],
      water: ['cianwood-city-area', 'johto-sea-route-41-area', 'whirl-islands-1f'],
      // The Whirl Islands, and the Cliff Cave on Route 47.
      cave: ['whirl-islands-1f', 'whirl-islands-b1f', 'johto-route-47-inside-cave'],
    },
    // HGSS's Safari Zone is past Route 48, west of Cianwood.
    safari: ['johto-safari-zone-meadow', 'johto-safari-zone-forest', 'johto-safari-zone-swamp', 'johto-safari-zone-savannah'],
  },
  {
    id: 'mahogany',
    badges: 6,
    shop: [...MART, 'ultra-ball', 'hyper-potion'],
    hunts: {
      grass: ['johto-route-42-area', 'johto-route-43-area'],
      // The Lake of Rage (Gyarados).
      water: ['lake-of-rage-area', 'johto-route-42-area', 'johto-route-43-area'],
      cave: ['mt-mortar-1f', 'mt-mortar-b1f', 'mt-mortar-lower-cave', 'mt-mortar-upper-cave'],
    },
  },
  {
    // The Super Rod: fishing in the Dragon's Den (Dratini) once Lv. 40 Pokémon are a fair catch.
    id: 'blackthorn',
    badges: 7,
    shop: [...MART, 'ultra-ball', 'hyper-potion', 'super-rod'],
    hunts: {
      grass: ['johto-route-44-area', 'johto-route-45-area'],
      water: ['dragons-den-area', 'johto-route-44-area'],
      cave: ['ice-path-1f', 'ice-path-b1f', 'ice-path-b2f', 'ice-path-b3f', 'dark-cave-blackthorn-city-entrance'],
    },
  },
  {
    // The Pokémon League, past Tohjo Falls; Mt. Silver rises beside it.
    id: 'johto-league',
    badges: 8,
    shop: [...MART, 'ultra-ball', 'hyper-potion', 'rare-candy'],
    hunts: {
      grass: ['mt-silver-outside'],
      water: ['tohjo-falls-area', 'mt-silver-1f'],
      cave: ['tohjo-falls-area', 'mt-silver-1f', 'mt-silver-1f-top'],
      rare: ['johto-hidden-grove'],
    },
  },
];

/** The 8 gyms, in badge order (Chuck before Jasmine, as the story goes), with their HeartGold/SoulSilver teams. */
const GYMS: Gym[] = [
  { badge: 'zephyr', city: 'violet', leader: 'Falkner', type: 'flying', badges: 0, team: [['pidgey', 9], ['pidgeotto', 13]], ai: { difficulty: 'normal', style: 'aggressive' }, sprite: 'falkner', badgeSprite: 9 },
  { badge: 'hive', city: 'azalea', leader: 'Bugsy', type: 'bug', badges: 1, team: [['metapod', 15], ['kakuna', 15], ['scyther', 17]], ai: { difficulty: 'normal', style: 'balanced' }, sprite: 'bugsy', badgeSprite: 10 },
  { badge: 'plain', city: 'goldenrod', leader: 'Whitney', type: 'normal', badges: 2, team: [['clefairy', 17], ['miltank', 19]], ai: { difficulty: 'normal', style: 'aggressive' }, sprite: 'whitney', badgeSprite: 11 },
  { badge: 'fog', city: 'ecruteak', leader: 'Morty', type: 'ghost', badges: 3, team: [['gastly', 21], ['haunter', 21], ['haunter', 23], ['gengar', 25]], ai: { difficulty: 'normal', style: 'zoner' }, sprite: 'morty', badgeSprite: 12 },
  { badge: 'storm', city: 'cianwood', leader: 'Chuck', type: 'fighting', badges: 4, team: [['primeape', 27], ['poliwrath', 30]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'chuck', badgeSprite: 13 },
  { badge: 'mineral', city: 'olivine', leader: 'Jasmine', type: 'steel', badges: 5, team: [['magnemite', 30], ['magnemite', 30], ['steelix', 35]], ai: { difficulty: 'hard', style: 'defensive' }, sprite: 'jasmine', badgeSprite: 14 },
  { badge: 'glacier', city: 'mahogany', leader: 'Pryce', type: 'ice', badges: 6, team: [['seel', 30], ['dewgong', 32], ['piloswine', 34]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'pryce', badgeSprite: 15 },
  { badge: 'rising', city: 'blackthorn', leader: 'Clair', type: 'dragon', badges: 7, team: [['dragonair', 38], ['gyarados', 38], ['dragonair', 38], ['kingdra', 41]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'clair', badgeSprite: 16 },
];

/** The Elite Four, with their HeartGold/SoulSilver teams (Koga, Bruno and Lance are back from Kanto, with new ids). */
const ELITE_FOUR: LeagueMember[] = [
  { id: 'will', name: 'Will', type: 'psychic', team: [['xatu', 40], ['jynx', 41], ['exeggutor', 41], ['slowbro', 41], ['xatu', 42]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'will' },
  { id: 'johto-koga', name: 'Koga', type: 'poison', team: [['ariados', 40], ['venomoth', 41], ['forretress', 43], ['muk', 42], ['crobat', 44]], ai: { difficulty: 'hard', style: 'defensive' }, sprite: 'koga' },
  { id: 'johto-bruno', name: 'Bruno', type: 'fighting', team: [['hitmontop', 42], ['hitmonlee', 42], ['hitmonchan', 42], ['onix', 43], ['machamp', 46]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'bruno' },
  { id: 'karen', name: 'Karen', type: 'dark', team: [['umbreon', 42], ['vileplume', 42], ['gengar', 45], ['murkrow', 44], ['houndoom', 47]], ai: { difficulty: 'hard', style: 'balanced' }, sprite: 'karen' },
];

/** The Champion is Lance (the rival is not the Champion in Johto). */
const CHAMPION: LeagueMember = {
  id: 'johto-lance',
  name: 'Lance',
  type: 'dragon',
  team: [['gyarados', 46], ['dragonite', 47], ['charizard', 46], ['aerodactyl', 46], ['dragonite', 47], ['dragonite', 50]],
  ai: { difficulty: 'hard', style: 'aggressive' },
  sprite: 'lance',
};

export const JOHTO: Region = {
  id: 'johto',
  generation: 2,
  lastSpecies: 251,
  color: '#d9a521',
  cover: ['ho-oh', 'lugia', 'suicune'],
  cities: CITIES,
  gyms: GYMS,
  league: { city: 'johto-league', eliteFour: ELITE_FOUR, champion: { kind: 'member', ...CHAMPION } },
  // Chikorita, Cyndaquil, Totodile, each with its first move of its own type; the rival takes the one that beats yours.
  starters: [152, 155, 158],
  starterGifts: { 152: 'razor-leaf', 155: 'ember', 158: 'water-gun' },
  rivalPick: { 152: 155, 155: 158, 158: 152 },
  people: { professor: 'elm', rival: 'silver' },
  training: ['sentret', 'hoothoot', 'spinarak'],
  art: {
    'new-bark': { backdrop: 'meadow', color: '#6fcf9a' },
    cherrygrove: { backdrop: 'beachshore', color: '#ff7a8f' },
    violet: { backdrop: 'route', color: '#9b6bff' },
    azalea: { backdrop: 'forest', color: '#4fae62' },
    goldenrod: { backdrop: 'city', color: '#ffc23a' },
    ecruteak: { backdrop: 'dampcave', color: '#e0823a' },
    olivine: { backdrop: 'beach', color: '#a8c84a' },
    cianwood: { backdrop: 'deepsea', color: '#3fb8d8' },
    mahogany: { backdrop: 'icecave', color: '#8fd0f0' },
    blackthorn: { backdrop: 'mountain', color: '#5a6cf0' },
    'johto-league': { backdrop: 'spl', color: '#b07bff' },
  },
  towns: {
    // Professor Elm's lab, by the sea Route 27 crosses.
    'new-bark': { ground: 'grass', row: ['house', 'lab', 'house'], water: ['seaRight'], light: 'day', grass: '#74c860' },
    cherrygrove: { ground: 'grass', row: ['house', 'center', 'mart', 'house'], water: ['seaBottom'], light: 'sunset', grass: '#80c85a' },
    // Sprout Tower.
    violet: { ground: 'grass', row: ['tower', 'center', 'mart', 'gym'], water: ['pond'], light: 'day', grass: '#6ab35e' },
    // At the edge of Ilex Forest; the Slowpoke Well.
    azalea: { ground: 'grass', row: ['gym', 'house', 'center', 'mart'], water: ['pond'], light: 'day', grass: '#428f42' },
    // The Department Store and the Radio Tower.
    goldenrod: { ground: 'paved', row: ['store', 'center', 'gym', 'mart', 'skyscraper'], water: [], light: 'sunset' },
    // The Burned Tower and the Bell Tower, in autumn colors.
    ecruteak: { ground: 'grass', row: ['tower', 'center', 'gym', 'mart', 'tower'], water: [], light: 'sunset', grass: '#a6b44a' },
    // The harbor at dusk; the tall white building on the right stands for the Glitter Lighthouse.
    olivine: { ground: 'grass', row: ['center', 'mart', 'gym', 'house', 'tall'], water: ['seaBottom'], light: 'dusk', grass: '#78c062' },
    // An island town; the Safari Zone's gate.
    cianwood: { ground: 'sand', row: ['center', 'mart', 'gym', 'gate'], water: ['seaRight'], light: 'day' },
    // Snow by the Ice Path; the Lake of Rage up north.
    mahogany: { ground: 'snow', row: ['house', 'mart', 'center', 'gym', 'house'], water: ['pond'], light: 'day' },
    // A mountain town; the Dragon's Den behind the gym.
    blackthorn: { ground: 'rock', row: ['house', 'center', 'gym', 'mart'], water: ['river', 'pond'], light: 'dusk' },
    'johto-league': { ground: 'grass', row: ['gate', 'league', 'center'], water: [], light: 'sunset', grass: '#5f9e5a' },
  },
  map: {
    // The mainland, with the bay of the Whirl Islands in the west and Route 27's inlet in the east (shapes made for
    // this map, roughly Johto's), and Cianwood's island.
    land: 'M12 8 Q30 2 50 3 Q68 0 84 3 Q96 2 98 14 Q99 30 97 44 Q95 54 87 56 Q85 48 82 42 Q79 39 77 43 Q75 53 70 55 Q63 57 56 55 Q48 58 40 57 Q32 59 27 56 Q23 52 25 46 Q26 40 24 36 Q19 32 14 29 Q7 25 8 16 Q8 10 12 8 Z',
    islands: [
      { x: 5, y: 40, r: 4.4 },
      { x: 13, y: 45, r: 1.5 },
      { x: 18, y: 48.5, r: 1.2 },
      { x: 11.5, y: 50, r: 1.1 },
      { x: 17, y: 43, r: 0.9 },
    ],
    lakes: [
      // The Lake of Rage.
      { x: 60, y: 5.5, rx: 4.2, ry: 2.2 },
    ],
    rivers: [
      // Tohjo Falls, down to Route 27's inlet.
      [
        [86, 26],
        [84, 31],
        [82, 36],
        [80, 41],
      ],
      // From Mt. Mortar's springs down to the western bay.
      [
        [41, 13],
        [39, 18],
        [35, 21],
        [29, 23],
        [23, 27],
        [18, 29],
      ],
    ],
    mountains: [
      // Mt. Mortar, along Route 42.
      [42, 11, 1],
      [45.5, 10, 1.2],
      [49, 11, 0.9],
      // The Ice Path.
      [65.5, 11, 0.9],
      [68.5, 10, 1.1],
      [71, 11, 0.8],
      // Mt. Silver, the highest, past the League.
      [88, 14, 1.1],
      [91.5, 12, 1.3],
      [95, 15, 1],
      [90, 18, 0.8],
      // Victory Road.
      [95, 33, 0.9],
      [95.5, 38, 0.7],
      // The Dark Cave, and Route 45's cliffs.
      [64, 30, 1],
      [67, 32.5, 0.8],
      [78, 22, 0.9],
      [77.5, 28, 0.7],
      // Union Cave.
      [50.5, 43, 0.9],
      [52.5, 45.5, 0.7],
      // Hills in the north-west.
      [17, 9, 0.8],
    ],
    forests: [
      // Ilex Forest.
      [36, 50.5, 3.6],
      // The National Park.
      [26.5, 31, 2.8],
      // Groves along the routes (38, 36, 43, 30, 29, 45, Mt. Silver's foot).
      [22, 16, 2],
      [39, 23, 1.8],
      [54.5, 7, 1.6],
      [61.5, 38, 1.8],
      [64, 51.5, 1.6],
      [79, 34, 1.6],
      [85, 20, 1.6],
      [42, 34, 2],
    ],
    places: {
      'new-bark': { x: 72, y: 48 },
      cherrygrove: { x: 58, y: 48 },
      violet: { x: 46, y: 26 },
      azalea: { x: 46, y: 50 },
      goldenrod: { x: 31, y: 36 },
      ecruteak: { x: 31, y: 12 },
      olivine: { x: 16, y: 24 },
      cianwood: { x: 5, y: 40 },
      mahogany: { x: 60, y: 12 },
      blackthorn: { x: 74, y: 12 },
      'johto-league': { x: 92, y: 32 },
      'johto-sanctuary': { x: 57, y: 34 },
    },
    // Roads go along one axis, then the other: the places are set so they follow the games' routes (29 east–west,
    // 30–31 up to Violet, 32 down to Azalea, Ilex and 34 up to Goldenrod, 35–37 through the National Park…).
    routes: [
      ['new-bark', 'cherrygrove'],
      ['cherrygrove', 'violet'],
      ['violet', 'azalea'],
      ['azalea', 'goldenrod'],
      ['violet', 'goldenrod'],
      ['goldenrod', 'ecruteak'],
      ['ecruteak', 'olivine'],
      ['olivine', 'cianwood'],
      ['ecruteak', 'mahogany'],
      ['mahogany', 'blackthorn'],
      ['blackthorn', 'new-bark'],
      ['new-bark', 'johto-league'],
      ['violet', 'johto-sanctuary'],
    ],
  },
  // The Hidden Grove, by the League (decided after milestone 14: every species can be obtained): this generation's
  // Pokémon nothing else reaches (the starters not chosen, the games' gifts and fossils, babies, evolutions this game
  // can't do). Base forms at Lv. 30–36, evolved ones at 40–46. Checked by game/obtainable.test.ts.
  grove: [
    ['chikorita', 30, 36],
    ['cyndaquil', 30, 36],
    ['totodile', 30, 36],
    ['igglybuff', 30, 36],
    ['togepi', 30, 36],
    ['shuckle', 30, 36],
    ['mantine', 40, 46],
    ['tyrogue', 30, 36],
    ['smoochum', 30, 36],
    ['elekid', 30, 36],
    ['magby', 30, 36],
  ],
  sanctuary: {
    id: 'johto-sanctuary',
    art: { backdrop: 'space', color: '#ffb347' },
    // Two old towers, like Ecruteak's, where the legends land.
    town: { ground: 'grass', row: ['tower', 'league', 'tower'], water: ['pond'], light: 'sunset', grass: '#8cbc54' },
    shop: ['ultra-ball', 'hyper-potion', 'master-ball'],
    legendaries: [
      // A future 'rampage' would suit Raikou (a lightning dash) and Entei (an eruption: 'quake'); 'vortex' Suicune
      // and Lugia (the north wind, Aeroblast).
      { species: 'raikou', level: 55, attacks: ['rampage', 'nova', 'meteor'], backdrop: 'thunderplains' },
      { species: 'entei', level: 55, attacks: ['quake', 'rampage', 'nova'], backdrop: 'volcanocave' },
      { species: 'suicune', level: 55, attacks: ['vortex', 'slash', 'nova'], backdrop: 'river' },
      { species: 'lugia', level: 70, attacks: ['vortex', 'meteor', 'slash'], backdrop: 'deepsea' },
      { species: 'ho-oh', level: 70, attacks: ['meteor', 'nova', 'slash'], backdrop: 'mountain' },
      { species: 'celebi', level: 60, attacks: ['nova', 'vortex', 'meteor'], backdrop: 'forest' },
    ],
  },
};
