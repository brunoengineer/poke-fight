// The Pokémon League: the Elite Four, then the Champion (the rival). A run is the five battles in a row; HP carries
// over between them (only potions help), and a loss anywhere ends the run.

import { speciesBySlug } from '../data/pokedex';
import { CHAMPION_AI, CHAMPION_TEAMS, ELITE_FOUR, type LeagueMember } from '../data/regions/kanto';
import { BADGE_COUNT } from './gym';
import { createPokemon, type Pokemon } from './pokemon';

export const LEAGUE_SIZE = ELITE_FOUR.length + 1;

export interface LeagueOpponent {
  kind: 'elite' | 'champion';
  /** For texts: an Elite Four id, or 'champion'. */
  id: string;
  name: string;
  /** The Elite Four member's type (the Champion has none). */
  type: string | null;
  team: Pokemon[];
  ai: LeagueMember['ai'];
}

const build = (team: readonly (readonly [string, number])[]) => team.map(([slug, level]) => createPokemon(speciesBySlug(slug).id, level));

export const canEnterLeague = (badges: readonly string[]) => badges.length >= BADGE_COUNT;

/** The opponent at this stage of the run (0–3: the Elite Four, 4: the Champion). */
export function leagueOpponent(stage: number, rival: { name: string; starterId: number }): LeagueOpponent {
  const member = ELITE_FOUR[stage];
  if (member) return { kind: 'elite', id: member.id, name: member.name, type: member.type, team: build(member.team), ai: member.ai };
  if (stage !== ELITE_FOUR.length) throw new Error(`No League stage ${stage}`);
  const team = CHAMPION_TEAMS[rival.starterId] ?? CHAMPION_TEAMS[7];
  return { kind: 'champion', id: 'champion', name: rival.name, type: null, team: build(team), ai: CHAMPION_AI };
}

/** League battles pay like gym leaders: 99 × the strongest Pokémon's level. */
export const leaguePrize = (team: readonly Pokemon[]) => 99 * Math.max(...team.map(p => p.level));
