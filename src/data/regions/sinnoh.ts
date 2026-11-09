// Sinnoh (generation 4), the fourth region: Diamond/Pearl/Platinum's towns, gyms, League and hunting grounds, with
// Platinum's where they differ (its gym order, its leaders' and Elite Four's teams, its encounter tables). Hunting
// grounds are PokeAPI location areas of the region's own games, grouped by kind (see kanto.ts and types.ts).

import type { ItemId } from '../items';
import type { City, Gym, LeagueMember, Region } from './types';

const MART: ItemId[] = ['poke-ball', 'great-ball', 'potion', 'super-potion'];
const LATE_MART: ItemId[] = [...MART, 'ultra-ball', 'hyper-potion'];

/** Every evolution item (the Veilstone Department Store sells them all). */
const EVOLUTION_ITEMS: ItemId[] = [
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

/** In story order (Platinum's: Fantina's gym comes third, before Veilstone). */
const CITIES: City[] = [
  {
    id: 'twinleaf',
    badges: 0,
    shop: null,
    hunts: { grass: ['sinnoh-route-201-area'], water: ['twinleaf-town-area', 'lake-verity-before-galactic-intervention'] },
  },
  {
    id: 'sandgem',
    badges: 0,
    shop: ['poke-ball', 'potion'],
    hunts: { grass: ['sinnoh-route-202-area'], water: ['sinnoh-route-219-area', 'sinnoh-sea-route-220-area'] },
  },
  {
    // The Old Rod: a fisherman in the gate to Route 218 hands it out in the games.
    id: 'jubilife',
    badges: 0,
    shop: ['poke-ball', 'potion', 'old-rod'],
    hunts: {
      grass: ['sinnoh-route-203-area', 'sinnoh-route-204-south-towards-jubilife-city'],
      water: ['sinnoh-route-203-area', 'sinnoh-route-204-south-towards-jubilife-city'],
    },
  },
  {
    id: 'oreburgh',
    badges: 0,
    shop: ['poke-ball', 'potion', 'super-potion'],
    hunts: {
      grass: ['sinnoh-route-207-area'],
      water: ['oreburgh-gate-b1f'],
      cave: ['oreburgh-mine-1f', 'oreburgh-mine-b1f', 'oreburgh-gate-1f', 'oreburgh-gate-b1f'],
    },
  },
  {
    id: 'floaroma',
    badges: 1,
    shop: MART,
    hunts: {
      grass: ['sinnoh-route-204-north-towards-floaroma-town', 'valley-windworks-area', 'sinnoh-route-205-south-towards-floaroma-town'],
      water: ['valley-windworks-area', 'sinnoh-route-205-south-towards-floaroma-town'],
    },
  },
  {
    // Eterna Forest and the routes around it; the caves are Wayward Cave (Gible) under the Cycling Road, and Mt.
    // Coronet's door on Route 211.
    id: 'eterna',
    badges: 1,
    shop: MART,
    hunts: {
      grass: ['eterna-forest-area', 'sinnoh-route-205-east-towards-eterna-city', 'sinnoh-route-206-area'],
      water: ['eterna-city-area', 'sinnoh-route-205-east-towards-eterna-city'],
      cave: ['wayward-cave-1f', 'wayward-cave-b1f', 'mt-coronet-1f-route-211'],
    },
  },
  {
    // The Good Rod: a fisherman on Route 209, just east of town, in the games.
    id: 'hearthome',
    badges: 2,
    shop: [...MART, 'good-rod'],
    hunts: {
      grass: ['sinnoh-route-208-area', 'sinnoh-route-212-north-towards-hearthome-city'],
      water: ['sinnoh-route-208-area', 'sinnoh-route-212-north-towards-hearthome-city'],
      cave: ['mt-coronet-1f-route-207'],
    },
  },
  {
    // The Lost Tower stands on Route 209; the Solaceon Ruins are full of Unown.
    id: 'solaceon',
    badges: 3,
    shop: MART,
    hunts: {
      grass: ['sinnoh-route-209-area', 'sinnoh-route-210-south-towards-solaceon-town'],
      water: ['sinnoh-route-209-area'],
      cave: ['lost-tower-1f', 'lost-tower-3f', 'lost-tower-5f', 'solaceon-ruins-1f'],
    },
  },
  {
    // The Veilstone Department Store: the big store (everything, including the Super Rod, the stones and the Link
    // Cable). Its grass: Routes 215 and 214; its cave: the Maniac Tunnel off Route 214 (Hippopotas).
    id: 'veilstone',
    badges: 3,
    shop: [...LATE_MART, 'super-rod', ...EVOLUTION_ITEMS],
    hunts: {
      grass: ['sinnoh-route-215-area', 'sinnoh-route-214-area', 'valor-lakefront-area'],
      water: ['sinnoh-route-214-area'],
      cave: ['ruin-maniac-cave-0-9-different-unown-caught'],
    },
  },
  {
    id: 'pastoria',
    badges: 4,
    shop: [...MART, 'ultra-ball'],
    hunts: {
      grass: ['sinnoh-route-212-east-towards-pastoria-city', 'sinnoh-route-213-area', 'trophy-garden-area'],
      water: ['pastoria-city-area', 'sinnoh-route-213-area', 'sinnoh-route-212-east-towards-pastoria-city'],
    },
    // The Great Marsh (each pair of areas shares a table: one of each).
    safari: ['great-marsh-area-1', 'great-marsh-area-3', 'great-marsh-area-5'],
  },
  {
    id: 'celestic',
    badges: 5,
    shop: LATE_MART,
    hunts: {
      grass: ['sinnoh-route-210-west-towards-celestic-town', 'sinnoh-route-211-east-towards-celestic-town'],
      water: ['celestic-town-area', 'sinnoh-route-210-west-towards-celestic-town'],
    },
  },
  {
    // Route 218 and Iron Island (Steelix in its depths). The Fuego Ironworks sit across the channel, off Route 205.
    id: 'canalave',
    badges: 5,
    shop: LATE_MART,
    hunts: {
      grass: ['sinnoh-route-218-area', 'fuego-ironworks-area'],
      water: ['canalave-city-area', 'iron-island-area', 'sinnoh-route-218-area'],
      cave: ['iron-island-1f', 'iron-island-b2f-left', 'iron-island-b3f'],
    },
  },
  {
    // The snowy north: Routes 216 and 217, Lake Acuity, and Mt. Coronet's snowfields (Absol).
    id: 'snowpoint',
    badges: 6,
    shop: LATE_MART,
    hunts: {
      grass: ['sinnoh-route-216-area', 'sinnoh-route-217-area', 'lake-acuity-area'],
      water: ['lake-acuity-area'],
      cave: ['mt-coronet-1f-route-216', 'mt-coronet-exterior-snowfall'],
    },
  },
  {
    id: 'sunyshore',
    badges: 7,
    shop: LATE_MART,
    hunts: {
      grass: ['sinnoh-route-222-area'],
      water: ['sunyshore-city-area', 'sinnoh-route-222-area', 'sinnoh-sea-route-223-area'],
    },
  },
  {
    id: 'sinnoh-league',
    badges: 8,
    shop: LATE_MART,
    hunts: {
      grass: ['sinnoh-route-224-area'],
      water: ['sinnoh-pokemon-league-area', 'sinnoh-route-224-area'],
      cave: ['sinnoh-victory-road-1f', 'sinnoh-victory-road-2f', 'sinnoh-victory-road-b1f'],
    },
  },
  {
    // The Battle Zone, after the League (a ferry from Snowpoint): its routes and Stark Mountain, the strongest wild
    // Pokémon of the region.
    id: 'fight-area',
    badges: 8,
    shop: LATE_MART,
    hunts: {
      grass: ['sinnoh-route-225-area', 'sinnoh-route-228-area', 'sinnoh-route-229-area'],
      water: ['resort-area-area', 'sinnoh-sea-route-226-area', 'sinnoh-sea-route-230-area'],
      cave: ['stark-mountain-entrance', 'stark-mountain-inside'],
    },
  },
];

/** The 8 gyms, in Platinum's order (leaders, badges and teams as in Platinum). */
const GYMS: Gym[] = [
  { badge: 'coal', city: 'oreburgh', leader: 'Roark', type: 'rock', badges: 0, team: [['geodude', 12], ['onix', 12], ['cranidos', 14]], ai: { difficulty: 'normal', style: 'defensive' }, sprite: 'roark', badgeSprite: 25 },
  { badge: 'forest', city: 'eterna', leader: 'Gardenia', type: 'grass', badges: 1, team: [['turtwig', 20], ['cherrim', 20], ['roserade', 22]], ai: { difficulty: 'normal', style: 'defensive' }, sprite: 'gardenia', badgeSprite: 26 },
  // Ghosts float and keep their distance.
  { badge: 'relic', city: 'hearthome', leader: 'Fantina', type: 'ghost', badges: 2, team: [['duskull', 24], ['haunter', 24], ['mismagius', 26]], ai: { difficulty: 'normal', style: 'zoner' }, sprite: 'fantina', badgeSprite: 29 },
  { badge: 'cobble', city: 'veilstone', leader: 'Maylene', type: 'fighting', badges: 3, team: [['meditite', 28], ['machoke', 29], ['lucario', 32]], ai: { difficulty: 'normal', style: 'aggressive' }, sprite: 'maylene', badgeSprite: 27 },
  // A wrestler with physical water Pokémon (Gyarados, Floatzel): he comes at you, unlike Misty.
  { badge: 'fen', city: 'pastoria', leader: 'Crasher Wake', type: 'water', badges: 4, team: [['gyarados', 33], ['quagsire', 34], ['floatzel', 37]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'crasherwake', badgeSprite: 28 },
  { badge: 'mine', city: 'canalave', leader: 'Byron', type: 'steel', badges: 5, team: [['magneton', 37], ['steelix', 38], ['bastiodon', 41]], ai: { difficulty: 'hard', style: 'defensive' }, sprite: 'byron', badgeSprite: 30 },
  { badge: 'icicle', city: 'snowpoint', leader: 'Candice', type: 'ice', badges: 6, team: [['sneasel', 40], ['piloswine', 40], ['abomasnow', 42], ['froslass', 44]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'candice', badgeSprite: 31 },
  { badge: 'beacon', city: 'sunyshore', leader: 'Volkner', type: 'electric', badges: 7, team: [['jolteon', 46], ['raichu', 46], ['luxray', 48], ['electivire', 50]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'volkner', badgeSprite: 32 },
];

/** The Elite Four, with their Platinum teams (the first challenge, before the National Pokédex). */
const ELITE_FOUR: LeagueMember[] = [
  { id: 'aaron', name: 'Aaron', type: 'bug', team: [['yanmega', 49], ['scizor', 49], ['vespiquen', 50], ['heracross', 51], ['drapion', 53]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'aaron' },
  { id: 'bertha', name: 'Bertha', type: 'ground', team: [['whiscash', 50], ['gliscor', 53], ['golem', 52], ['hippowdon', 52], ['rhyperior', 55]], ai: { difficulty: 'hard', style: 'defensive' }, sprite: 'bertha' },
  { id: 'flint', name: 'Flint', type: 'fire', team: [['houndoom', 52], ['flareon', 55], ['rapidash', 53], ['infernape', 55], ['magmortar', 57]], ai: { difficulty: 'hard', style: 'aggressive' }, sprite: 'flint' },
  { id: 'lucian', name: 'Lucian', type: 'psychic', team: [['mr-mime', 53], ['espeon', 55], ['bronzong', 54], ['alakazam', 56], ['gallade', 59]], ai: { difficulty: 'hard', style: 'zoner' }, sprite: 'lucian' },
];

/** The Champion isn't the rival here: Cynthia, with her Platinum team. */
const CHAMPION: LeagueMember = {
  id: 'cynthia',
  name: 'Cynthia',
  type: null,
  team: [['spiritomb', 58], ['roserade', 58], ['togekiss', 60], ['lucario', 60], ['milotic', 58], ['garchomp', 62]],
  ai: { difficulty: 'hard', style: 'balanced' },
  sprite: 'cynthia',
};

export const SINNOH: Region = {
  id: 'sinnoh',
  generation: 4,
  lastSpecies: 493,
  color: '#6f86d6',
  cover: ['giratina', 'dialga', 'palkia'],
  cities: CITIES,
  gyms: GYMS,
  league: { city: 'sinnoh-league', eliteFour: ELITE_FOUR, champion: { kind: 'member', ...CHAMPION } },
  // Turtwig, Chimchar, Piplup. Turtwig's gift is Razor Leaf, its own first grass attack (it learns no grass move
  // before Lv. 9, and Absorb is too weak to carry a fight).
  starters: [387, 390, 393],
  starterGifts: { 387: 'razor-leaf', 390: 'ember', 393: 'bubble' },
  rivalPick: { 387: 390, 390: 393, 393: 387 },
  people: { professor: 'rowan', rival: 'barry' },
  training: ['bidoof', 'starly', 'shinx'],
  art: {
    twinleaf: { backdrop: 'route', color: '#86d68f' },
    sandgem: { backdrop: 'beachshore', color: '#f0c070' },
    jubilife: { backdrop: 'city', color: '#ffb347' },
    oreburgh: { backdrop: 'earthycave', color: '#b0784a' },
    floaroma: { backdrop: 'meadow', color: '#ff86c8' },
    eterna: { backdrop: 'forest', color: '#4fae5f' },
    hearthome: { backdrop: 'city', color: '#ff6f8a' },
    solaceon: { backdrop: 'desert', color: '#d8c27a' },
    veilstone: { backdrop: 'mountain', color: '#9aa0b4' },
    pastoria: { backdrop: 'river', color: '#5fb08a' },
    celestic: { backdrop: 'dampcave', color: '#a98bd8' },
    canalave: { backdrop: 'beach', color: '#4f9ae0' },
    snowpoint: { backdrop: 'icecave', color: '#a8dcff' },
    sunyshore: { backdrop: 'thunderplains', color: '#ffd23a' },
    'sinnoh-league': { backdrop: 'spl', color: '#8f7bff' },
    'fight-area': { backdrop: 'volcanocave', color: '#ff6a3a' },
  },
  towns: {
    // Lake Verity's shore by the houses.
    twinleaf: { ground: 'grass', row: ['house', 'house', 'house'], water: ['pond'], light: 'day', grass: '#7ccf58' },
    // Professor Rowan's lab by the beach.
    sandgem: { ground: 'sand', row: ['house', 'lab', 'center', 'mart'], water: ['seaBottom'], light: 'day' },
    // The big city: the TV station's tower among office blocks.
    jubilife: { ground: 'paved', row: ['tall', 'center', 'skyscraper', 'mart', 'tall'], water: [], light: 'day' },
    // The coal-mining town, its Mining Museum, at sunset.
    oreburgh: { ground: 'rock', row: ['gym', 'center', 'museum', 'mart'], water: [], light: 'sunset' },
    floaroma: { ground: 'grass', row: ['house', 'center', 'house', 'mart'], water: ['pond'], light: 'day', grass: '#8ad65e' },
    // The old town by the forest; the tall block is Team Galactic's building.
    eterna: { ground: 'grass', row: ['house', 'center', 'gym', 'mart', 'tall'], water: ['pond'], light: 'day', grass: '#4fa84a' },
    // The Contest Hall, Amity Square's pond, a warm evening.
    hearthome: { ground: 'paved', row: ['museum', 'center', 'gym', 'mart'], water: ['pond'], light: 'sunset' },
    // The Solaceon Ruins' entrance.
    solaceon: { ground: 'grass', row: ['house', 'center', 'mart', 'gate'], water: ['pond'], light: 'day', grass: '#9cc65a' },
    // A town carved in rock: the Department Store, the gym, Galactic's headquarters.
    veilstone: { ground: 'rock', row: ['store', 'center', 'gym', 'tall'], water: [], light: 'day' },
    // The Great Marsh's gate and the river.
    pastoria: { ground: 'grass', row: ['center', 'gym', 'mart', 'gate'], water: ['river', 'pond'], light: 'day', grass: '#5aa858' },
    // The ancient shrine in the mountains, at dusk.
    celestic: { ground: 'rock', row: ['house', 'museum', 'center', 'mart'], water: ['pond'], light: 'dusk' },
    // The library, the canal through town, the harbor.
    canalave: { ground: 'paved', row: ['museum', 'center', 'gym', 'mart'], water: ['river', 'seaBottom'], light: 'sunset' },
    // Snow, the sea to the north, the temple's gate.
    snowpoint: { ground: 'snow', row: ['center', 'gym', 'mart', 'gate'], water: ['seaRight'], light: 'day' },
    // The Vista Lighthouse over the beach.
    sunyshore: { ground: 'sand', row: ['center', 'gym', 'mart', 'tower'], water: ['seaBottom'], light: 'sunset' },
    'sinnoh-league': { ground: 'paved', row: ['center', 'league', 'mart'], water: ['seaBottom'], light: 'dusk' },
    // The Battle Frontier's tower, and Stark Mountain smoking behind.
    'fight-area': { ground: 'rock', row: ['tall', 'center', 'mart', 'volcano'], water: ['seaRight'], light: 'day' },
  },
  map: {
    // The mainland (a shape made for this map, roughly Sinnoh's: Mt. Coronet down the middle, the cold north, the
    // League across the sea from Sunyshore), Iron Island, the Battle Zone, Full Moon and Newmoon Islands.
    land: 'M7 30 Q8 24 13 21 Q20 18 26 12 Q31 5 38 3 Q46 0 54 3 Q59 6 61 11 Q67 15 76 13 Q86 11 92 17 Q98 24 92 31 Q86 34 79 36 Q84 41 92 41 Q99 45 95 52 Q87 57 72 56 Q58 59 44 57 Q30 59 22 57 Q18 56 17.5 48 Q17 38 14.5 33 Q12.5 38 12.5 48 Q12 55 7 54 Q3 50 4 42 Q4 35 7 30 Z',
    islands: [
      { x: 2.6, y: 29, r: 1.7 },
      { x: 87, y: 6, r: 4.6 },
      { x: 95, y: 3.5, r: 1.6 },
      { x: 96, y: 57, r: 1.4 },
      { x: 5, y: 57, r: 1.3 },
    ],
    // Lakes Verity, Valor and Acuity.
    lakes: [
      { x: 21, y: 49.5, rx: 2, ry: 1.3 },
      { x: 73, y: 40, rx: 3.2, ry: 1.9 },
      { x: 37.5, y: 7.5, rx: 2, ry: 1.2 },
    ],
    rivers: [
      // From the mountains down through Eterna and Floaroma (Route 205).
      [
        [40, 18],
        [36, 20],
        [30, 26],
        [26, 30],
        [21, 35],
        [17.5, 38],
      ],
      // From Lake Valor down to the sea by Pastoria (the Great Marsh).
      [
        [73, 41.5],
        [72, 45],
        [74, 50],
        [73, 55],
        [73, 57],
      ],
    ],
    // Mt. Coronet down the middle (with snowy peaks to the north), Oreburgh's hills, Victory Road, Stark Mountain.
    mountains: [
      [44, 13, 1.2],
      [47, 16, 1.1],
      [41, 16, 0.9],
      [45, 20, 1.3],
      [48.5, 24, 1],
      [43, 25, 1.2],
      [47, 28, 1.1],
      [42, 31, 0.9],
      [44.5, 35, 1.3],
      [48, 38, 1],
      [43, 40, 1.1],
      [46, 44, 0.9],
      [40, 11, 0.9],
      [50, 10, 0.8],
      [39, 45, 0.8],
      [36, 47, 0.7],
      [90, 28, 1.1],
      [93, 25, 0.9],
      [86, 31, 0.8],
      [88, 7, 1.1],
      [85, 9, 0.8],
      [17, 23, 0.8],
      // The cliffs around Veilstone (Routes 214 and 215).
      [82, 22, 0.8],
      [73.5, 22.5, 0.7],
    ],
    // Eterna Forest, the woods of the north, Routes 210 and 212, the Great Marsh, Route 201.
    forests: [
      [27, 20, 4],
      [33, 12, 3],
      [56, 12, 2.5],
      [60, 26, 2.8],
      [61, 47, 3],
      [67, 52, 2.2],
      [26, 55, 1.8],
      [36, 50, 2.5],
      [82, 46, 2],
      [8, 44, 2],
      [69, 17, 2.4],
      [50, 52, 2.4],
      [80, 19, 1.6],
    ],
    places: {
      twinleaf: { x: 22, y: 53 },
      sandgem: { x: 30, y: 52 },
      jubilife: { x: 26, y: 42 },
      canalave: { x: 8, y: 37 },
      oreburgh: { x: 36, y: 42 },
      floaroma: { x: 22, y: 31 },
      eterna: { x: 32, y: 24 },
      hearthome: { x: 55, y: 40 },
      solaceon: { x: 64, y: 31 },
      veilstone: { x: 78, y: 27 },
      pastoria: { x: 69, y: 48 },
      celestic: { x: 53, y: 21 },
      snowpoint: { x: 45, y: 5 },
      sunyshore: { x: 88, y: 47 },
      'sinnoh-league': { x: 89, y: 22 },
      'fight-area': { x: 86, y: 5 },
      'sinnoh-sanctuary': { x: 47, y: 31 },
    },
    routes: [
      ['twinleaf', 'sandgem'],
      ['sandgem', 'jubilife'],
      ['jubilife', 'oreburgh'],
      ['jubilife', 'canalave'],
      ['jubilife', 'floaroma'],
      ['floaroma', 'eterna'],
      ['eterna', 'oreburgh'],
      ['oreburgh', 'hearthome'],
      ['eterna', 'celestic'],
      ['hearthome', 'solaceon'],
      ['hearthome', 'pastoria'],
      ['solaceon', 'celestic'],
      ['solaceon', 'veilstone'],
      ['veilstone', 'pastoria'],
      ['pastoria', 'sunyshore'],
      ['sunyshore', 'sinnoh-league'],
      ['celestic', 'snowpoint'],
      ['snowpoint', 'fight-area'],
      ['celestic', 'sinnoh-sanctuary'],
    ],
  },
  sanctuary: {
    // Spear Pillar, at the top of Mt. Coronet: ruined columns and a lone tower in the snow, under the stars.
    id: 'sinnoh-sanctuary',
    art: { backdrop: 'space', color: '#b8b0ff' },
    town: { ground: 'snow', row: ['museum', 'league', 'museum', 'tower'], water: [], light: 'night' },
    shop: ['ultra-ball', 'hyper-potion', 'master-ball'],
    // Boss attacks (fight/boss.ts): slash, a wave across the screen; nova, a sphere around it; meteor, a rain from the
    // sky; quake, the ground shakes; rampage, a charge; vortex, a pull toward it.
    legendaries: [
      // The lake guardians: knowledge, emotion, willpower.
      { species: 'uxie', level: 50, attacks: ['nova', 'meteor', 'vortex'], backdrop: 'icecave' },
      { species: 'mesprit', level: 50, attacks: ['nova', 'slash', 'meteor'], backdrop: 'river' },
      { species: 'azelf', level: 50, attacks: ['slash', 'rampage', 'nova'], backdrop: 'dampcave' },
      // Time (Roar of Time bursts out of it) and space (Spacial Rend is a cut through space itself).
      { species: 'dialga', level: 70, attacks: ['nova', 'meteor', 'quake', 'slash'], backdrop: 'space' },
      { species: 'palkia', level: 70, attacks: ['slash', 'vortex', 'nova', 'meteor'], backdrop: 'deepsea' },
      // Shadow Force and the Distortion World that pulls everything in.
      { species: 'giratina', level: 70, attacks: ['vortex', 'slash', 'rampage'], backdrop: 'dampcave' },
      // Magma Storm and eruptions.
      { species: 'heatran', level: 60, attacks: ['quake', 'meteor', 'nova'], backdrop: 'volcanocave' },
      // The colossus that towed the continents.
      { species: 'regigigas', level: 65, attacks: ['quake', 'rampage', 'slash'], backdrop: 'icecave' },
      // The crescent moon and the new moon's nightmares (Darkrai's Dark Void pulls into sleep).
      { species: 'cresselia', level: 55, attacks: ['nova', 'meteor', 'vortex'], backdrop: 'space' },
      { species: 'darkrai', level: 60, attacks: ['vortex', 'nova', 'slash'], backdrop: 'forest' },
      { species: 'shaymin', level: 55, attacks: ['nova', 'meteor', 'slash'], backdrop: 'meadow' },
      { species: 'manaphy', level: 50, attacks: ['vortex', 'nova', 'slash'], backdrop: 'deepsea' },
      // Judgment rains down from the sky. (Phione, a mythical but weak one, stays out.)
      { species: 'arceus', level: 75, attacks: ['meteor', 'nova', 'quake', 'slash'], backdrop: 'space' },
    ],
  },
};
