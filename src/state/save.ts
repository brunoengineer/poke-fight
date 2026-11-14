// The save: plain JSON in the browser's storage, with a version number. Pure (no storage here: see store.ts).
//
// Changing the format: bump SAVE_VERSION, add a migration from the old version to MIGRATIONS, and keep a fixture of the
// old format in src/state/fixtures/ (the fixture test then proves old saves still load).

import { isItemId } from '../data/items';
import { hasSpecies, move, species } from '../data/pokedex';
import { hasCity, hasRegion, isRegion, isSanctuary, region as regionData, regionOf, type RegionId } from '../data/regions';
import { START_BAG, START_MONEY, type Bag } from '../game/economy';
import { movesKnownAt } from '../game/moves';
import { maxHpOf, type Pokemon } from '../game/pokemon';
import { specialOptions } from '../game/progress';
import { DEFAULT_NAMES, MAX_NAME_LENGTH } from '../game/story';
import { MAX_LEVEL } from '../game/xp';
import { isLanguage, type Language } from '../i18n';

export const SAVE_VERSION = 7;

export interface Settings {
  language: Language;
}

/** The prologue: the rival tutorial still to play, or done (then the journey is on). */
export type PrologueStage = 'tutorial' | 'done';
export const PROLOGUE_STAGES: readonly PrologueStage[] = ['tutorial', 'done'];

export interface Save {
  version: typeof SAVE_VERSION;
  createdAt: number;
  settings: Settings;
  player: { name: string };
  rival: { name: string; starterId: number };
  starterId: number;
  prologue: PrologueStage;
  /** Where the player is (a city or the sanctuary of the current region). */
  location: string;
  /** Up to 6 Pokémon that fight, in order. */
  party: Pokemon[];
  /** Everything else caught (the PC box). */
  box: Pokemon[];
  money: number;
  bag: Bag;
  /** Species ids seen in battle and caught (the Pokédex). */
  dex: { seen: number[]; caught: number[] };
  /** Badges won (gym badge ids), in the order they were won. */
  badges: string[];
  /** The region the player is in now: the fields above are its journey. */
  region: RegionId;
  /** This region's League has been beaten. */
  champion: boolean;
  /** Every region whose League has been won (each one opens the next). */
  champions: RegionId[];
  /** The other regions' journeys, kept while the player is elsewhere (decided after milestone 11: one per region). */
  away: Partial<Record<RegionId, RegionJourney>>;
  /** Every winning team, newest last. */
  hallOfFame: HallOfFameEntry[];
}

/** What belongs to one region's journey (the rest of the save is the player's, everywhere). */
export const JOURNEY_KEYS = ['rival', 'starterId', 'prologue', 'location', 'party', 'box', 'money', 'bag', 'dex', 'badges', 'champion'] as const;
export type RegionJourney = Pick<Save, (typeof JOURNEY_KEYS)[number]>;

export interface HallOfFameEntry {
  at: number;
  team: { speciesId: number; level: number }[];
  /** Where (saves from before the regions: Kanto). */
  region?: RegionId;
}

export const MAX_PARTY = 6;

export interface NewJourney {
  playerName: string;
  rivalName: string;
  starterId: number;
  rivalStarterId: number;
  party: Pokemon[];
}

/** A new journey starts right after the starter is chosen: the rival tutorial comes next. */
export function newSave(journey: NewJourney, createdAt: number, language: Language): Save {
  return {
    version: SAVE_VERSION,
    createdAt,
    settings: { language },
    player: { name: journey.playerName },
    rival: { name: journey.rivalName, starterId: journey.rivalStarterId },
    starterId: journey.starterId,
    prologue: 'tutorial',
    location: 'pallet',
    party: structuredClone(journey.party),
    box: [],
    money: START_MONEY,
    bag: { ...START_BAG },
    dex: { seen: [...new Set([journey.starterId, journey.rivalStarterId])], caught: [journey.starterId] },
    badges: [],
    region: 'kanto',
    champion: false,
    champions: [],
    away: {},
    hallOfFame: [],
  };
}

/** The journey of the region the player is in. */
export const journeyOf = (save: Save): RegionJourney =>
  Object.fromEntries(JOURNEY_KEYS.map(key => [key, structuredClone(save[key])])) as unknown as RegionJourney;

/** Travels to a region the player has a journey in: this region's journey is kept aside, that one comes back. */
export function switchRegion(save: Save, to: RegionId): Save {
  if (to === save.region) return save;
  const back = save.away[to];
  if (!back) throw new Error(`No journey in ${to} yet`);
  const away = { ...save.away, [save.region]: journeyOf(save) };
  delete away[to];
  return { ...save, ...structuredClone(back), region: to, away };
}

/**
 * A new journey in another region (decided after milestone 11): a new starter from that region, the starting money
 * and balls, no badges, and a new Pokédex; it starts in the region's first city. The current journey is kept aside.
 */
export function startRegion(save: Save, to: RegionId, start: { starterId: number; rivalStarterId: number; party: Pokemon[] }): Save {
  const away = { ...save.away, [save.region]: journeyOf(save) };
  delete away[to];
  const journey: RegionJourney = {
    rival: { name: save.rival.name, starterId: start.rivalStarterId },
    starterId: start.starterId,
    prologue: 'done',
    location: regionData(to).cities[0].id,
    party: structuredClone(start.party),
    box: [],
    money: START_MONEY,
    bag: { ...START_BAG },
    dex: { seen: [...new Set([start.starterId, start.rivalStarterId])], caught: [start.starterId] },
    badges: [],
    champion: false,
  };
  return { ...save, ...journey, region: to, away };
}

/**
 * Version 7 (decided 2026-11-14, the official learnsets): every Pokémon also knows the moves the new lists teach by its
 * level (HeartGold/SoulSilver's, its earlier forms' included). Nothing it knew is taken away, so its specials stay.
 * Anything malformed is left as it is, for findProblem to refuse.
 */
function teachOfficialMoves(p: Pokemon): Pokemon {
  if (typeof p !== 'object' || p === null || !hasSpecies(p.speciesId) || !Array.isArray(p.moves) || !Number.isInteger(p.level)) return p;
  const missing = movesKnownAt(species(p.speciesId), p.level).filter(m => !p.moves.includes(m));
  return { ...p, moves: [...p.moves, ...missing] };
}

function teachJourney<T extends Record<string, unknown>>(journey: T): T {
  if (typeof journey !== 'object' || journey === null) return journey;
  const all = (list: unknown) => (Array.isArray(list) ? list.map(teachOfficialMoves) : list);
  return { ...journey, party: all(journey.party), box: all(journey.box) };
}

/** Migrations from version N to N + 1. */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {
  // Version 1 saves come from before the prologue (the sandbox party): they become a journey already at Viridian,
  // with the default names; the first Pokémon counts as the starter.
  1: old => ({
    ...old,
    version: 2,
    player: { name: DEFAULT_NAMES.player },
    rival: { name: DEFAULT_NAMES.rival, starterId: 7 },
    starterId: (old.party as Pokemon[])[0]?.speciesId ?? 4,
    prologue: 'done',
    location: 'viridian',
  }),
  // Version 2 saves (before the world opened): the starting money and balls, and a Pokédex of what they own.
  2: old => {
    const owned = [...(old.party as Pokemon[]), ...(old.box as Pokemon[])].map(p => p.speciesId);
    const rival = (old.rival as { starterId: number }).starterId;
    return {
      ...old,
      version: 3,
      money: START_MONEY,
      bag: { ...START_BAG },
      dex: { seen: [...new Set([...owned, rival])], caught: [...new Set(owned)] },
    };
  },
  // Version 3 saves (before the gyms opened): no badges yet.
  3: old => ({ ...old, version: 4, badges: [] }),
  // Version 4 saves (before the League): in Kanto, not Champion yet.
  4: old => ({ ...old, version: 5, region: 'kanto', champion: false, hallOfFame: [] }),
  // Version 5 saves (before the other regions): the Kanto journey; a Kanto Champion has opened the next region.
  5: old => ({
    ...old,
    version: 6,
    champions: old.champion === true ? ['kanto'] : [],
    away: {},
    hallOfFame: (old.hallOfFame as HallOfFameEntry[]).map(entry => ({ ...entry, region: 'kanto' })),
  }),
  // Version 6 saves (Red/Blue's thin learnsets for Kanto): every Pokémon, in every journey, learns what it missed.
  6: old => ({
    ...teachJourney(old),
    version: 7,
    away: Object.fromEntries(Object.entries((old.away as Record<string, Record<string, unknown>>) ?? {}).map(([id, j]) => [id, teachJourney(j)])),
  }),
};

export type LoadResult =
  | { status: 'none' }
  | { status: 'ok'; save: Save }
  | { status: 'broken'; reason: 'unreadable' | 'newer' | 'invalid'; detail: string };

/** Reads a saved JSON string: migrates old versions, and refuses anything broken (the caller keeps a copy). */
export function parseSave(raw: string | null): LoadResult {
  if (raw === null) return { status: 'none' };
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    return { status: 'broken', reason: 'unreadable', detail: String(error) };
  }
  if (typeof data !== 'object' || data === null || typeof data.version !== 'number') {
    return { status: 'broken', reason: 'invalid', detail: 'no version' };
  }
  if (data.version > SAVE_VERSION) return { status: 'broken', reason: 'newer', detail: `version ${data.version}` };
  while ((data.version as number) < SAVE_VERSION) {
    const migrate = MIGRATIONS[data.version as number];
    if (!migrate) return { status: 'broken', reason: 'invalid', detail: `no migration from version ${data.version}` };
    data = migrate(data);
  }
  const problem = findProblem(data);
  return problem ? { status: 'broken', reason: 'invalid', detail: problem } : { status: 'ok', save: data as unknown as Save };
}

/** What is wrong with a save, or null if nothing is. */
export function findProblem(data: Record<string, unknown>): string | null {
  if (!isRegion(data.region) || !hasRegion(data.region)) return 'bad region';
  const settings = data.settings as Settings | undefined;
  if (!settings || !isLanguage(settings.language)) return 'settings missing';
  const player = data.player as Save['player'] | undefined;
  if (!player || !validName(player.name)) return 'bad player name';
  const champions = data.champions;
  if (!Array.isArray(champions) || !champions.every(isRegion)) return 'bad champions';
  const fame = data.hallOfFame as HallOfFameEntry[] | undefined;
  const validEntry = (e: HallOfFameEntry) =>
    Number.isFinite(e?.at) && Array.isArray(e.team) && e.team.length > 0 && e.team.every(m => hasSpecies(m.speciesId) && Number.isInteger(m.level));
  if (!Array.isArray(fame) || !fame.every(validEntry)) return 'bad Hall of Fame';
  const here = journeyProblem(data, data.region);
  if (here) return here;
  const away = data.away as Record<string, unknown> | undefined;
  if (typeof away !== 'object' || away === null) return 'away missing';
  for (const [id, journey] of Object.entries(away)) {
    if (!isRegion(id) || !hasRegion(id) || id === data.region) return `bad away region ${id}`;
    const problem = journeyProblem(journey as Record<string, unknown>, id);
    if (problem) return `${id}: ${problem}`;
  }
  return null;
}

const validName = (name: unknown) => typeof name === 'string' && name.trim().length > 0 && name.length <= MAX_NAME_LENGTH;

/** What is wrong with one region's journey, or null. */
function journeyProblem(data: Record<string, unknown>, regionId: RegionId): string | null {
  if (typeof data !== 'object' || data === null) return 'journey missing';
  const party = data.party;
  if (!Array.isArray(party) || party.length === 0 || party.length > MAX_PARTY) return 'party must have 1 to 6 Pokémon';
  if (!Array.isArray(data.box)) return 'box missing';
  const rival = data.rival as Save['rival'] | undefined;
  if (!rival || !validName(rival.name) || !hasSpecies(rival.starterId)) return 'bad rival';
  if (typeof data.starterId !== 'number' || !hasSpecies(data.starterId)) return 'bad starter';
  if (!PROLOGUE_STAGES.includes(data.prologue as PrologueStage)) return 'bad prologue stage';
  // A city or the sanctuary of this region (regions not written yet can't be checked: they can't be saved in either).
  const location = data.location;
  if (typeof location !== 'string' || !(hasCity(location) || isSanctuary(location)) || regionOf(location).id !== regionId) return 'bad location';
  if (!Number.isInteger(data.money) || (data.money as number) < 0) return 'bad money';
  const bag = data.bag as Record<string, unknown> | undefined;
  if (typeof bag !== 'object' || bag === null) return 'bag missing';
  for (const [id, count] of Object.entries(bag)) {
    if (!isItemId(id) || !Number.isInteger(count) || (count as number) < 1) return `bad bag entry ${id}`;
  }
  const dex = data.dex as Save['dex'] | undefined;
  const speciesList = (list: unknown) => Array.isArray(list) && list.every(id => Number.isInteger(id) && hasSpecies(id));
  if (!dex || !speciesList(dex.seen) || !speciesList(dex.caught)) return 'bad Pokédex';
  const badges = data.badges;
  const known = regionData(regionId).gyms.map(g => g.badge);
  if (!Array.isArray(badges) || badges.some(b => !known.includes(b)) || new Set(badges).size !== badges.length) return 'bad badges';
  if (typeof data.champion !== 'boolean') return 'bad champion flag';
  for (const [i, p] of [...party, ...(data.box as Pokemon[])].entries()) {
    const problem = pokemonProblem(p as Pokemon);
    if (problem) return `Pokémon ${i}: ${problem}`;
  }
  return null;
}

function pokemonProblem(p: Pokemon): string | null {
  if (typeof p !== 'object' || p === null) return 'not an object';
  if (!Number.isInteger(p.speciesId) || !hasSpecies(p.speciesId)) return `unknown species ${p.speciesId}`;
  if (!Number.isInteger(p.level) || p.level < 1 || p.level > MAX_LEVEL) return `bad level ${p.level}`;
  if (!Number.isInteger(p.xp) || p.xp < 0) return 'bad xp';
  if (!Array.isArray(p.moves) || p.moves.some(slug => typeof slug !== 'string')) return 'bad moves';
  try {
    p.moves.forEach(move);
  } catch {
    return 'unknown move';
  }
  if (!Number.isInteger(p.hp) || p.hp < 0 || p.hp > maxHpOf(p)) return `bad hp ${p.hp}`;
  const options = specialOptions(p);
  if (!p.specials || !options.includes(p.specials.elemental) || !options.includes(p.specials.big)) return 'bad specials';
  return null;
}

export const serializeSave = (save: Save) => JSON.stringify(save);
