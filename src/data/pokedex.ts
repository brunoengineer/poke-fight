// Typed access to the generated Pokémon data (scripts/build-data.mjs → src/data/generated/). One file per
// generation; a new region registers its file here.

import gen1 from './generated/gen1.json';
import gen2 from './generated/gen2.json';
import gen3 from './generated/gen3.json';
import gen4 from './generated/gen4.json';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export type Evolution = { to: number } & (
  | { kind: 'level'; level: number }
  | { kind: 'item'; item: string }
  | { kind: 'trade'; item?: string }
  | { kind: 'friendship' }
  | { kind: 'other' }
);

export interface Encounter {
  area: string;
  version: string;
  method: string;
  minLevel: number;
  maxLevel: number;
  chance: number;
}

export interface Species {
  id: number;
  slug: string;
  name: string;
  types: string[];
  stats: BaseStats;
  baseExperience: number;
  growthRate: string;
  captureRate: number;
  legendary: boolean;
  mythical: boolean;
  evolvesFrom: number | null;
  /** Only evolutions into species the game has data for. */
  evolutions: Evolution[];
  learnset: { level: number; move: string }[];
  /**
   * Where it is found in its own generation's games (Gen 1: Red/Blue, every method). Hunting reads
   * wildEncounters() instead, which also has older species in later regions.
   */
  encounters: Encounter[];
  /** The Pokédex page: "Seed Pokémon", size, and the entry from its region's games (English, like the names). */
  dex: { genus: string; heightM: number; weightKg: number; entry: string };
}

export type MoveCategory = 'physical' | 'special' | 'status';

export interface Move {
  name: string;
  type: string;
  /** null for moves without a fixed power (status moves, Seismic Toss, OHKO moves…). */
  power: number | null;
  category: MoveCategory;
}

/** A wild encounter of one species in one area (an entry of a region's encounter tables). */
export interface WildEncounter extends Encounter {
  speciesId: number;
}

interface GenerationFile {
  generation: number;
  species: Species[];
  moves: Record<string, Move>;
  /**
   * Gen 2 on: the region's walk and rod tables for every species up to that generation, inside the region only
   * (HeartGold/SoulSilver's Kanto stays out). Gen 1 has none: Kanto's tables are its species' encounters.
   */
  encounters?: WildEncounter[];
}

const FILES = [gen1, gen2, gen3, gen4] as unknown as GenerationFile[];

const SPECIES = new Map<number, Species>();
const MOVES = new Map<string, Move>();
const WILD: WildEncounter[] = [];
for (const file of FILES) {
  for (const s of file.species) SPECIES.set(s.id, s);
  for (const [slug, m] of Object.entries(file.moves)) MOVES.set(slug, m);
  if (file.encounters) WILD.push(...file.encounters);
  else for (const s of file.species) WILD.push(...s.encounters.map(e => ({ ...e, speciesId: s.id })));
}
// Drop evolutions into species the game has no data for (Eevee → Sylveon) until their generation exists.
for (const s of SPECIES.values()) s.evolutions = s.evolutions.filter(e => SPECIES.has(e.to));

export function species(id: number): Species {
  const found = SPECIES.get(id);
  if (!found) throw new Error(`Unknown species ${id}`);
  return found;
}

export function speciesBySlug(slug: string): Species {
  const found = [...SPECIES.values()].find(s => s.slug === slug);
  if (!found) throw new Error(`Unknown species ${slug}`);
  return found;
}

export function move(slug: string): Move {
  const found = MOVES.get(slug);
  if (!found) throw new Error(`Unknown move ${slug}`);
  return found;
}

export const allSpecies = (): Species[] => [...SPECIES.values()];
export const hasSpecies = (id: number) => SPECIES.has(id);

/** The species numbered 1..lastId that the game has, in order (a region's Pokédex: every species up to its last). */
export function speciesUpTo(lastId: number): number[] {
  return Array.from({ length: Math.max(0, Math.floor(lastId)) }, (_, i) => i + 1).filter(id => SPECIES.has(id));
}

/** Every wild encounter of every region: Kanto's (Red/Blue) and each later region's tables. */
export const wildEncounters = (): readonly WildEncounter[] => WILD;
