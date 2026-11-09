// What a region is: its cities (with their hunting grounds and shops), its 8 gyms, its League, its starters, its
// pictures (the backgrounds of each place, the people's sprites, the badges), its pixel-art towns, its world map, and
// its Legendary Sanctuary. A region is one file like kanto.ts, registered in index.ts. Every id (city, badge, League
// member) is unique across regions: texts and pictures are found by id.

import type { Difficulty, Style } from '../../fight/ai/profiles';
import type { Backdrop } from '../art';
import type { ItemId } from '../items';

export type RegionId = 'kanto' | 'johto' | 'hoenn' | 'sinnoh';

export type HuntKind = 'grass' | 'water' | 'cave';

/** [species slug, level] */
export type TeamSpec = readonly (readonly [species: string, level: number])[];

export interface Ai {
  difficulty: Difficulty;
  style: Style;
}

export interface City {
  id: string;
  /** Badges needed to travel there. */
  badges: number;
  /** What its Poké Mart sells (null: no shop). */
  shop: ItemId[] | null;
  /**
   * Hunting grounds: PokeAPI location-area names from the region's own games, by kind (grass and cave: walking;
   * water: fishing with the best rod owned).
   */
  hunts: Partial<Record<HuntKind, string[]>>;
  /** A Safari Zone's areas. */
  safari?: string[];
}

export interface Gym {
  /** The badge's id (unique across regions). */
  badge: string;
  city: string;
  leader: string;
  type: string;
  /** Badges needed to challenge it (on top of reaching the city). */
  badges: number;
  /** The leader's team, as in the region's games. */
  team: TeamSpec;
  /** How the leader fights: a CPU difficulty and a style that suits the type. */
  ai: Ai;
  /** The leader's Showdown trainer sprite. */
  sprite: string;
  /** The badge's picture: its number in PokeAPI's badge sprites. */
  badgeSprite: number;
}

/** An Elite Four member, or a Champion who isn't the rival. Their lines: `elite.<id>.intro` / `elite.<id>.beaten`. */
export interface LeagueMember {
  /** Unique across regions (e.g. 'lorelei', 'johto-bruno'). */
  id: string;
  name: string;
  /** Their type (null for a Champion with a mixed team). */
  type: string | null;
  team: TeamSpec;
  ai: Ai;
  sprite: string;
}

export type Champion =
  /** The rival (Kanto): their team depends on the starter they took (by species id). Lines: `champion.intro/beaten`. */
  | { kind: 'rival'; teams: Record<number, TeamSpec>; ai: Ai }
  | ({ kind: 'member' } & LeagueMember);

export interface League {
  /** The city where it is (it needs 8 badges). */
  city: string;
  eliteFour: readonly LeagueMember[];
  champion: Champion;
}

/** A city's pixel-art town (render/town.ts). */
export type TownFeature =
  | 'house'
  | 'center'
  | 'mart'
  | 'gym'
  | 'lab'
  | 'museum'
  | 'tower'
  | 'store'
  | 'tall'
  | 'skyscraper'
  | 'gate'
  | 'league'
  | 'volcano';

export interface TownPlan {
  ground: 'grass' | 'rock' | 'sand' | 'paved' | 'snow';
  /** The main row, left to right (houses fill the gaps). */
  row: TownFeature[];
  /** The sea along the bottom or the right, a river on the right, a pond in the second row. */
  water: ('seaBottom' | 'seaRight' | 'river' | 'pond')[];
  light: 'day' | 'sunset' | 'dusk' | 'night';
  /** The grass color (CSS hex), a little different per town. */
  grass?: string;
}

/** Each place's look: its background (fights and menus) and a theme color for its screens. */
export interface CityArt {
  backdrop: Backdrop;
  color: string;
}

/** The world map, in a 100 × 60 box (render/region-map.ts paints it as pixel art). */
export interface RegionMap {
  /** The main land: an SVG path (M, L, Q, Z) in map units. */
  land: string;
  /** Islands (circles). */
  islands: { x: number; y: number; r: number }[];
  lakes: { x: number; y: number; rx: number; ry: number }[];
  /** Rivers: polylines of [x, y]. */
  rivers: [number, number][][];
  /** Mountains: [x, y of the foot, size (0.7–1.3)]. */
  mountains: [number, number, number][];
  /** Forests: [x, y, radius]. */
  forests: [number, number, number][];
  /** Where each city sits, and the sanctuary. */
  places: Record<string, { x: number; y: number }>;
  /** Roads between places (by id). */
  routes: [string, string][];
}

/** A legendary waiting in the sanctuary. Its attacks are the fight's boss attacks (fight/boss.ts). */
export interface Legendary {
  species: string;
  level: number;
  /** BossAttackId values (kept as strings here: data doesn't depend on the fight). */
  attacks: string[];
  backdrop: Backdrop;
}

export interface Sanctuary {
  /** Its id (a place on the map; texts `city.<id>` and `city.<id>.tagline`). */
  id: string;
  art: CityArt;
  town: TownPlan;
  /** Its shop (the only place that sells Master Balls). */
  shop: ItemId[];
  legendaries: Legendary[];
}

export interface Region {
  id: RegionId;
  /** Its Pokémon's generation: its Pokédex is every species up to `lastSpecies`. */
  generation: number;
  lastSpecies: number;
  /** The region's color (the travel screen). */
  color: string;
  /** The legendaries on its travel card: the one in front first, then the two beside it (from its sanctuary). */
  cover: readonly [string, string, string];
  /** In story order: the first one is where a journey starts. */
  cities: City[];
  /** The 8 gyms, in badge order. */
  gyms: Gym[];
  league: League;
  /** The three starters (species ids), the move the Professor teaches each, and the rival's pick for each. */
  starters: [number, number, number];
  starterGifts: Record<number, string>;
  rivalPick: Record<number, number>;
  /** The Professor and the rival (Showdown sprites); the Professor's name is the text `region.<id>.professor`. */
  people: { professor: string; rival: string };
  /** Battle-field opponents (species slugs, met at the party's level). */
  training: string[];
  art: Record<string, CityArt>;
  towns: Record<string, TownPlan>;
  map: RegionMap;
  sanctuary: Sanctuary;
}
