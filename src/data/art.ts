// Which picture goes where: the places' backgrounds, the people's sprites, items and badges. Pure data and URLs (like
// the Pokémon sprites, everything is loaded by URL when needed; nothing is copied into the project).
//
// Sources: Pokémon Showdown's battle backgrounds and trainer sprites, and the PokeAPI sprites repository (items,
// badges). Showdown sends no CORS header: its images can be drawn and shown, never read back pixel by pixel.

const SHOWDOWN = 'https://play.pokemonshowdown.com';
const POKEAPI = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';

/** Showdown's modern battle backgrounds (753×500 pixel art). */
export type Backdrop =
  | 'route'
  | 'meadow'
  | 'forest'
  | 'city'
  | 'beach'
  | 'beachshore'
  | 'river'
  | 'deepsea'
  | 'mountain'
  | 'earthycave'
  | 'dampcave'
  | 'icecave'
  | 'volcanocave'
  | 'desert'
  | 'thunderplains'
  | 'space'
  | 'spl';

// Showdown serves the space picture as a JPEG.
export const backdropUrl = (backdrop: Backdrop) => `${SHOWDOWN}/fx/bg-${backdrop}.${backdrop === 'space' ? 'jpg' : 'png'}`;

/** A trainer or a character, by Showdown sprite name (80×80, full body, facing the viewer). */
export const trainerUrl = (sprite: string) => `${SHOWDOWN}/sprites/trainers/${sprite}.png`;

/** Items whose sprite has another name on PokeAPI (the Link Cable is drawn as the later games' Linking Cord). */
const ITEM_SPRITES: Readonly<Record<string, string>> = { 'link-cable': 'linking-cord' };

export const itemUrl = (item: string) => `${POKEAPI}/items/${ITEM_SPRITES[item] ?? item}.png`;

/** Kanto's badges are 1–8 in gym order. */
export const badgeUrl = (number: number) => `${POKEAPI}/badges/${number}.png`;

/** Each city's look: its background and a theme color for the menus. */
export interface CityArt {
  backdrop: Backdrop;
  /** The accent color of the city's screens. */
  color: string;
}

export const CITY_ART: Record<string, CityArt> = {
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
};

export const cityArt = (id: string): CityArt => CITY_ART[id] ?? { backdrop: 'route', color: '#6c8cff' };

/** Where a fight happens, by kind of place. */
export const HUNT_BACKDROPS = { grass: 'route', forest: 'forest', cave: 'earthycave', water: 'beach', safari: 'meadow' } as const satisfies Record<
  string,
  Backdrop
>;

/** A gym (or an Elite Four room) looks like its type. */
export const TYPE_BACKDROPS: Record<string, Backdrop> = {
  rock: 'mountain',
  ground: 'desert',
  water: 'river',
  ice: 'icecave',
  electric: 'thunderplains',
  grass: 'meadow',
  bug: 'forest',
  poison: 'dampcave',
  ghost: 'dampcave',
  psychic: 'space',
  fire: 'volcanocave',
  fighting: 'mountain',
  dragon: 'space',
  normal: 'city',
  flying: 'mountain',
};

export const typeBackdrop = (type: string | null | undefined): Backdrop => (type ? (TYPE_BACKDROPS[type] ?? 'city') : 'spl');

/** The people: their sprites. Gym leaders are keyed by badge, the Elite Four by id. */
export const PEOPLE = {
  player: 'red',
  rival: 'blue',
  professor: 'oak',
  nurse: 'nurse',
  clerk: 'clerkf',
  champion: 'blue',
} as const;

export const LEADER_SPRITES: Record<string, string> = {
  boulder: 'brock',
  cascade: 'misty',
  thunder: 'ltsurge',
  rainbow: 'erika',
  soul: 'koga',
  marsh: 'sabrina',
  volcano: 'blaine',
  earth: 'giovanni',
};

export const ELITE_SPRITES: Record<string, string> = {
  lorelei: 'lorelei-gen3',
  bruno: 'bruno',
  agatha: 'agatha-gen3',
  lance: 'lance',
};

/** Trainers on the battle field: a class picked from the opponents' team, so it stays the same for the same team. */
export const TRAINER_CLASSES = [
  'youngster',
  'lass',
  'camper',
  'picnicker',
  'bugcatcher',
  'hiker',
  'birdkeeper',
  'beauty',
  'fisherman',
  'swimmerf',
  'gentleman',
  'juggler',
  'blackbelt',
  'acetrainer',
  'acetrainerf',
] as const;

export function trainerClassFor(speciesIds: readonly number[]): string {
  const sum = speciesIds.reduce((total, id, i) => total + id * (i + 1), 0);
  return TRAINER_CLASSES[sum % TRAINER_CLASSES.length];
}

/** The Pokémon Center's helper (a Chansey) stands next to the nurse. */
export const CHANSEY = 113;

/** Kanto's badges in gym order (the badge sprites are numbered this way). */
export const BADGE_ORDER = ['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth'] as const;

export const badgeArt = (badge: string) => badgeUrl(BADGE_ORDER.indexOf(badge as (typeof BADGE_ORDER)[number]) + 1);

/** Where each city sits on the world map (in a 100 × 60 box), and the routes drawn between them. */
export const KANTO_MAP: Record<string, { x: number; y: number }> = {
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
};

export const KANTO_ROUTES: [string, string][] = [
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
];
