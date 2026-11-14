// Moves in the fight (plan.md §4.4): which moves a Pokémon knows, which ones can be specials, and the shape each
// takes in the fight.
//   - Elemental slot: always a range attack. Moves with "beam" in their name are beams, everything else (including
//     contact moves like Scratch) becomes a projectile of its type.
//   - Big slot: its form comes from the move's type (plan.md §4.9): a Ground move is a quake wave, a Water move a
//     surf wave, a Fire move a tornado… Normal moves keep the old rule: physical → a Rush, special → a beam.

import { move, species, type Species } from '../data/pokedex';
import type { BigShape, ElementalShape } from '../fight/frame-data';

export const STRUGGLE = 'struggle';

/**
 * Moves that make no sense as a special in a fighter: they knock out the user (Self-Destruct, Explosion; Memento,
 * Healing Wish and Lunar Dance are status moves anyway, listed so they stay out) or only work while someone sleeps
 * (Dream Eater, Snore).
 */
export const NOT_SPECIALS = new Set(['self-destruct', 'explosion', 'memento', 'healing-wish', 'lunar-dance', 'dream-eater', 'snore']);

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

/** The big special's form for each type (Normal: by category, below). */
export const BIG_SHAPES: Record<string, BigShape> = {
  fire: 'tornado',
  water: 'surf',
  electric: 'strike',
  grass: 'solar',
  ice: 'blizzard',
  fighting: 'rush',
  poison: 'surf',
  ground: 'quake',
  flying: 'tornado',
  psychic: 'burst',
  bug: 'projectile',
  rock: 'barrage',
  ghost: 'strike',
  dragon: 'barrage',
  dark: 'burst',
  steel: 'beam',
  fairy: 'burst',
};

export function bigShape(slug: string): BigShape {
  const m = move(slug);
  return BIG_SHAPES[m.type] ?? (m.category === 'physical' ? 'rush' : 'beam');
}

/**
 * What a species learns by level up: its own learnset and its earlier forms' (decided 2026-11-14), each move at the
 * lowest level any of them learns it. So evolving early (a stone, a Rare Candy) never costs the moves the earlier form
 * would have learned later: Pikachu evolved at Lv. 10 still learns Thunderbolt when it gets there, as a Raichu.
 */
export function learnable(s: Species): { level: number; move: string }[] {
  const lowest = new Map<string, number>();
  for (let form: Species | null = s; form; form = form.evolvesFrom === null ? null : species(form.evolvesFrom)) {
    for (const entry of form.learnset) lowest.set(entry.move, Math.min(lowest.get(entry.move) ?? Infinity, entry.level));
  }
  return [...lowest].map(([move, level]) => ({ level, move })).sort((a, b) => a.level - b.level || a.move.localeCompare(b.move));
}

/** Every move learned by level up to this level, plus gifts (the starters' first type move), in learning order. */
export function movesKnownAt(s: Species, level: number, gifts: readonly string[] = []): string[] {
  const learned = learnable(s).filter(entry => entry.level <= level).map(entry => entry.move);
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
