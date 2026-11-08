// Moves in the fight (plan.md §4.4): which moves a Pokémon knows, which ones can be specials, and the shape each
// takes in the fight.
//   - Elemental slot: always a range attack. Moves with "beam" in their name are beams, everything else (including
//     contact moves like Scratch) becomes a projectile of its type.
//   - Big slot: physical moves become a Rush (the "big dash"); special moves keep their shape.

import { move, type Species } from '../data/pokedex';
import type { BigShape, ElementalShape } from '../fight/frame-data';

export const STRUGGLE = 'struggle';

/**
 * Moves that make no sense as a special in a fighter: they knock out the user (Self-Destruct, Explosion) or only work
 * on a sleeping target (Dream Eater).
 */
export const NOT_SPECIALS = new Set(['self-destruct', 'explosion', 'dream-eater']);

/** A move that can be a special: it does damage with a fixed power (and has no game-breaking drawback). */
export const isDamaging = (slug: string) => {
  const m = move(slug);
  return m.power !== null && m.category !== 'status' && !NOT_SPECIALS.has(slug);
};

/** Beams that don't say so in their name. */
const BEAMS = new Set(['psybeam', 'aurora-beam', 'bubble-beam', 'hyper-beam', 'solar-beam', 'ice-beam']);

export function elementalShape(slug: string): ElementalShape {
  return BEAMS.has(slug) || slug.endsWith('-beam') ? 'beam' : 'projectile';
}

export function bigShape(slug: string): BigShape {
  return move(slug).category === 'physical' ? 'rush' : elementalShape(slug);
}

/** Every move learned by level up to this level, plus gifts (the starters' first type move), in learning order. */
export function movesKnownAt(species: Species, level: number, gifts: readonly string[] = []): string[] {
  const learned = species.learnset.filter(entry => entry.level <= level).map(entry => entry.move);
  return [...new Set([...learned, ...gifts])];
}

export interface SpecialChoice {
  elemental: string;
  big: string;
}

/**
 * The specials a Pokémon starts with (the player can change them later):
 *   - elemental: its strongest move of its own type, or its strongest move if it has none;
 *   - big: its strongest move.
 * "Strongest" counts the same-type bonus (Ember 40 × 1.5 beats Scratch 40). Ties go to the move learned last.
 * No damaging move at all: Struggle in both slots.
 */
export function defaultSpecials(species: Species, known: readonly string[]): SpecialChoice {
  const damaging = known.filter(isDamaging);
  if (damaging.length === 0) return { elemental: STRUGGLE, big: STRUGGLE };
  const effective = (slug: string) => (move(slug).power ?? 0) * (species.types.includes(move(slug).type) ? 1.5 : 1);
  // `>=` keeps the later move on a tie (moves are in learning order).
  const strongest = (slugs: string[]) => slugs.reduce((best, slug) => (effective(slug) >= effective(best) ? slug : best));
  const ownType = damaging.filter(slug => species.types.includes(move(slug).type));
  return {
    elemental: strongest(ownType.length > 0 ? ownType : damaging),
    big: strongest(damaging),
  };
}
