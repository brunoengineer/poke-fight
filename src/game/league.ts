// The Pokémon League: the Elite Four, then the Champion (the rival). A run is the five battles in a row; HP carries
// over between them (only potions help), and a loss anywhere ends the run.

import { speciesBySlug } from '../data/pokedex';
import type { Ai, Region } from '../data/regions/types';
import { BADGE_COUNT } from './gym';
import { createPokemon, type Pokemon } from './pokemon';

/** The Elite Four, then the Champion: five battles in every region. */
export const LEAGUE_SIZE = 5;

export interface LeagueOpponent {
  kind: 'elite' | 'champion';
  /** For texts: an Elite Four id, or 'champion'. */
  id: string;
  name: string;
  /** Their type (null for a Champion with a mixed team). */
  type: string | null;
  team: Pokemon[];
  ai: Ai;
  /** Their Showdown sprite (the rival's for a rival Champion). */
  sprite: string;
}

const build = (team: readonly (readonly [string, number])[]) => team.map(([slug, level]) => createPokemon(speciesBySlug(slug).id, level));

export const canEnterLeague = (badges: readonly string[]) => badges.length >= BADGE_COUNT;

/** The opponent at this stage of a region's run (0–3: the Elite Four, 4: the Champion). */
export function leagueOpponent(region: Region, stage: number, rival: { name: string; starterId: number }): LeagueOpponent {
  const { eliteFour, champion } = region.league;
  const member = eliteFour[stage];
  if (member) return { kind: 'elite', id: member.id, name: member.name, type: member.type, team: build(member.team), ai: member.ai, sprite: member.sprite };
  if (stage !== eliteFour.length) throw new Error(`No League stage ${stage}`);
  if (champion.kind === 'member') {
    return { kind: 'champion', id: champion.id, name: champion.name, type: champion.type, team: build(champion.team), ai: champion.ai, sprite: champion.sprite };
  }
  // The rival: the team for the starter they took (any team if theirs isn't listed).
  const team = champion.teams[rival.starterId] ?? Object.values(champion.teams)[0];
  return { kind: 'champion', id: 'champion', name: rival.name, type: null, team: build(team), ai: champion.ai, sprite: region.people.rival };
}

/** League battles pay like gym leaders: 99 × the strongest Pokémon's level. */
export const leaguePrize = (team: readonly Pokemon[]) => 99 * Math.max(...team.map(p => p.level));
