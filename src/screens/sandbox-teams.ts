// The sandbox teams: real Pokémon at Lv. 30–34 with their default specials, chosen to show every special shape and
// some type matchups:
//   - Charmeleon (projectiles) vs Butterfree: Fire is super effective on Bug.
//   - Kadabra (beams) vs Gastly: Psychic is super effective on Poison.
//   - Machoke (Rush) vs Geodude: Fighting is super effective on Rock; but Karate Chop can't touch Gastly (Ghost).

import { speciesBySlug } from '../data/pokedex';
import type { TeamMember } from '../fight/battle';
import { createPokemon, toFighter, type Pokemon } from '../game/pokemon';

const member = (slug: string, level: number): TeamMember => toFighter(createPokemon(speciesBySlug(slug).id, level));

/** The party a new game starts with, until the prologue gives a starter (milestone 6). */
export const sandboxParty = (): Pokemon[] => ['charmeleon', 'kadabra', 'machoke'].map(slug => createPokemon(speciesBySlug(slug).id, 30));

export const PLAYER_TEAM: TeamMember[] = sandboxParty().map(toFighter);

export const OPPONENT_TEAM: TeamMember[] = [member('geodude', 30), member('gastly', 30), member('butterfree', 34)];
