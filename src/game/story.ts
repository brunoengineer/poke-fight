// The prologue's rules: the starters, the Professor's gift move, the rival's pick, names, and Training opponents.

import { speciesBySlug } from '../data/pokedex';
import { createPokemon, type Pokemon } from './pokemon';

export const STARTER_LEVEL = 5;

/** Bulbasaur, Charmander, Squirtle. */
export const STARTERS = [1, 4, 7] as const;
export type StarterId = (typeof STARTERS)[number];

/** The first type move the Professor teaches each starter (their Lv. 5 learnsets have none). */
export const STARTER_GIFTS: Record<StarterId, string> = { 1: 'vine-whip', 4: 'ember', 7: 'bubble' };

/** The rival takes the starter that beats yours, as in the games. */
export const RIVAL_PICK: Record<StarterId, StarterId> = { 1: 4, 4: 7, 7: 1 };

export const isStarter = (id: number): id is StarterId => (STARTERS as readonly number[]).includes(id);

export function createStarter(id: StarterId): Pokemon {
  return createPokemon(id, STARTER_LEVEL, { gifts: [STARTER_GIFTS[id]] });
}

/** Original default names (the player can type their own). */
export const DEFAULT_NAMES = { player: 'Kai', rival: 'Ren' };
export const MAX_NAME_LENGTH = 12;

/** Trims, collapses spaces and cuts a typed name; an empty name becomes the default. */
export function cleanName(input: string, fallback: string): string {
  const name = input.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
  return name || fallback;
}

/** Training opponents: three common Kanto Pokémon at the party's average level. */
export const TRAINING_SPECIES = ['rattata', 'pidgey', 'geodude'];

export function trainingOpponents(party: readonly Pokemon[]): Pokemon[] {
  const average = Math.round(party.reduce((sum, p) => sum + p.level, 0) / party.length);
  const level = Math.min(100, Math.max(3, average));
  return TRAINING_SPECIES.map(slug => createPokemon(speciesBySlug(slug).id, level));
}
