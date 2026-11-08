// Typed access to the generated Pokémon data (scripts/build-data.mjs → src/data/generated/). One file per
// generation; a new region registers its file here.

import gen1 from './generated/gen1.json';

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
  encounters: Encounter[];
}

export type MoveCategory = 'physical' | 'special' | 'status';

export interface Move {
  name: string;
  type: string;
  /** null for moves without a fixed power (status moves, Seismic Toss, OHKO moves…). */
  power: number | null;
  category: MoveCategory;
}

interface GenerationFile {
  generation: number;
  species: Species[];
  moves: Record<string, Move>;
}

const FILES = [gen1 as unknown as GenerationFile];

const SPECIES = new Map<number, Species>();
const MOVES = new Map<string, Move>();
for (const file of FILES) {
  for (const s of file.species) SPECIES.set(s.id, s);
  for (const [slug, m] of Object.entries(file.moves)) MOVES.set(slug, m);
}
// Drop evolutions into species from later generations (Eevee → Espeon) until their region exists.
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
