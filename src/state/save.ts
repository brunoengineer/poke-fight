// The save: plain JSON in the browser's storage, with a version number. Pure (no storage here: see store.ts).
//
// Changing the format: bump SAVE_VERSION, add a migration from the old version to MIGRATIONS, and keep a fixture of the
// old format in src/state/fixtures/ (the fixture test then proves old saves still load).

import { hasSpecies, move } from '../data/pokedex';
import { maxHpOf, type Pokemon } from '../game/pokemon';
import { specialOptions } from '../game/progress';
import { MAX_LEVEL } from '../game/xp';
import { isLanguage, type Language } from '../i18n';

export const SAVE_VERSION = 1;

export interface Settings {
  language: Language;
}

export interface Save {
  version: typeof SAVE_VERSION;
  createdAt: number;
  /** Up to 6 Pokémon that fight, in order. */
  party: Pokemon[];
  /** Everything else caught (the PC box, milestone 7). */
  box: Pokemon[];
  settings: Settings;
}

export const MAX_PARTY = 6;

export function newSave(party: Pokemon[], createdAt: number, language: Language): Save {
  return { version: SAVE_VERSION, createdAt, party: structuredClone(party), box: [], settings: { language } };
}

/** Migrations from version N to N + 1 (none yet: version 1 is the first). */
const MIGRATIONS: Record<number, (old: Record<string, unknown>) => Record<string, unknown>> = {};

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
  const party = data.party;
  if (!Array.isArray(party) || party.length === 0 || party.length > MAX_PARTY) return 'party must have 1 to 6 Pokémon';
  if (!Array.isArray(data.box)) return 'box missing';
  const settings = data.settings as Settings | undefined;
  if (!settings || !isLanguage(settings.language)) return 'settings missing';
  for (const [i, p] of [...party, ...data.box].entries()) {
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
