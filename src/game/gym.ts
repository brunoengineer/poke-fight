// Gyms (plan.md §3): the leader's team, what beating them pays, and who can challenge them.

import { speciesBySlug } from '../data/pokedex';
import type { Gym } from '../data/regions';
import { createPokemon, type Pokemon } from './pokemon';

/** Every region has 8 gyms. */
export const BADGE_COUNT = 8;

export function gymTeam(gym: Gym): Pokemon[] {
  return gym.team.map(([slug, level]) => createPokemon(speciesBySlug(slug).id, level));
}

/** Leaders pay 99 × the level of their strongest Pokémon (as in Red/Blue: Brock pays ₽1386). */
export const LEADER_PRIZE = 99;
export const leaderPrize = (gym: Gym) => LEADER_PRIZE * Math.max(...gym.team.map(([, level]) => level));

/** A gym can be challenged once the player has the badges it needs, and only until it's beaten. */
export const canChallenge = (gym: Gym, badges: readonly string[]) => !badges.includes(gym.badge) && badges.length >= gym.badges;
