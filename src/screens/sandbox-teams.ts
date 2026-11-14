// The sandbox teams: real Pokémon at Lv. 30–34 with their default specials, chosen to show both elemental shapes,
// six big forms and some type matchups:
//   - Charmeleon (Fire Fang: fire tornado) vs Butterfree (Silver Wind: projectile): Fire is super effective on Bug.
//   - Kadabra (Psybeam: beam, psychic burst) vs Gastly (Shadow Ball: shadow strike): Psychic is super effective on Poison.
//   - Machoke (Vital Throw: rush) vs Geodude (Earthquake: quake): Fighting is super effective on Rock; but Vital Throw
//     can't touch Gastly (Ghost).

import { speciesBySlug } from '../data/pokedex';
import type { TeamMember } from '../fight/battle';
import { createPokemon, toFighter, type Pokemon } from '../game/pokemon';

const member = (slug: string, level: number): TeamMember => toFighter(createPokemon(speciesBySlug(slug).id, level));

/** The party a new game starts with, until the prologue gives a starter (milestone 6). */
export const sandboxParty = (): Pokemon[] => ['charmeleon', 'kadabra', 'machoke'].map(slug => createPokemon(speciesBySlug(slug).id, 30));

export const PLAYER_TEAM: TeamMember[] = sandboxParty().map(toFighter);

export const OPPONENT_TEAM: TeamMember[] = [member('geodude', 30), member('gastly', 30), member('butterfree', 34)];
