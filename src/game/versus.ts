// Versus (plan.md §4.10): two players pick three Pokémon each, at Lv. 100, from every species of the regions opened
// in the journey, then fight; no switching, and the side that loses a Pokémon picks the next. Pure: the selection's
// state and its moves (the screen, ui/screens/versus.ts, only shows it).

import { REGIONS, regionOpen, type RegionId } from '../data/regions';
import { createPokemon, toFighter } from './pokemon';
import type { TeamMember } from '../fight/battle';
import { uniformIvs } from './stats';

export const VERSUS_LEVEL = 100;
export const VERSUS_TEAM = 3;
/** The selection grid's columns (the screen lays it out the same). */
export const VERSUS_COLUMNS = 10;

/** Every species of the regions opened in the journey (Kanto's 151 without one), in Pokédex order. */
export function versusRoster(champions: readonly RegionId[]): number[] {
  const last = Math.max(...REGIONS.filter(r => regionOpen(r.id, champions)).map(r => r.lastSpecies));
  return Array.from({ length: last }, (_, i) => i + 1);
}

/** Where each generation starts in the roster (index), to jump between them (LB / RB). */
export function generationStarts(roster: readonly number[]): number[] {
  const starts = [0];
  for (const r of REGIONS) {
    const next = roster.indexOf(r.lastSpecies + 1);
    if (next > 0) starts.push(next);
  }
  return starts;
}

export interface VersusSide {
  /** Index in the roster. */
  cursor: number;
  /** Species picked, in order (the first one fights first). */
  picks: number[];
  ready: boolean;
}

export type VersusAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back' | 'prevGen' | 'nextGen';

export const freshSide = (cursor = 0): VersusSide => ({ cursor, picks: [], ready: false });

/**
 * One player's action on the selection: move the cursor (it stops at the edges), jump a generation, pick the species
 * under the cursor (once per team; three picks, then confirm again: ready), or go back (not ready; then the last
 * pick). Returns 'leave' when back is pressed with nothing left to undo.
 */
export function versusAct(side: VersusSide, action: VersusAction, roster: readonly number[]): VersusSide | 'leave' {
  const rows = Math.ceil(roster.length / VERSUS_COLUMNS);
  const col = side.cursor % VERSUS_COLUMNS;
  const row = Math.floor(side.cursor / VERSUS_COLUMNS);
  const at = (r: number, c: number) => Math.min(roster.length - 1, Math.max(0, r * VERSUS_COLUMNS + c));
  if (action === 'back') {
    if (side.ready) return { ...side, ready: false };
    if (side.picks.length > 0) return { ...side, picks: side.picks.slice(0, -1) };
    return 'leave';
  }
  if (side.ready) return side;
  switch (action) {
    case 'left':
      return col > 0 ? { ...side, cursor: side.cursor - 1 } : side;
    case 'right':
      return col < VERSUS_COLUMNS - 1 && side.cursor + 1 < roster.length ? { ...side, cursor: side.cursor + 1 } : side;
    case 'up':
      return row > 0 ? { ...side, cursor: at(row - 1, col) } : side;
    case 'down':
      return row < rows - 1 ? { ...side, cursor: at(row + 1, col) } : side;
    case 'prevGen':
    case 'nextGen': {
      const starts = generationStarts(roster);
      const current = starts.filter(s => s <= side.cursor).length - 1;
      const next = action === 'nextGen' ? Math.min(starts.length - 1, current + 1) : Math.max(0, side.cursor > starts[current] ? current : current - 1);
      return { ...side, cursor: starts[next] };
    }
    case 'confirm': {
      if (side.picks.length >= VERSUS_TEAM) return { ...side, ready: true };
      const id = roster[side.cursor];
      return side.picks.includes(id) ? side : { ...side, picks: [...side.picks, id] };
    }
  }
}

/** A picked team, ready to fight: Lv. 100, perfect IVs (a fair fight: only the Pokémon chosen differ). */
export const versusTeam = (picks: readonly number[]): TeamMember[] =>
  picks.map(id => toFighter(createPokemon(id, VERSUS_LEVEL, { ivs: uniformIvs(31) })));
