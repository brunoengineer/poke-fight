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

/** A badge's picture, by its number in PokeAPI's badge sprites (each region's gyms say theirs). */
export const badgeUrl = (number: number) => `${POKEAPI}/badges/${number}.png`;

// Each place's look (background and theme color), the leaders' and the Elite Four's sprites, the badges and the
// world map are each region's (data/regions/*.ts).

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

/** The people everywhere (the Professor and the rival are each region's; leaders and the League are in their data). */
export const PEOPLE = {
  player: 'red',
  nurse: 'nurse',
  clerk: 'clerkf',
} as const;

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
