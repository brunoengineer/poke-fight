// Growing: XP, level ups (stats and new moves), evolution and choosing specials. Pure: each function returns a new
// Pokémon and never changes the one it was given.

import type { EvolutionItemId } from '../data/items';
import { species, type Evolution } from '../data/pokedex';
import { isDamaging, learnable, STRUGGLE } from './moves';
import { maxHpOf, type Pokemon } from './pokemon';
import { levelForXp, MAX_LEVEL, xpForLevel } from './xp';

export interface LevelUp {
  level: number;
  /** Moves learned at this level. */
  moves: string[];
}

export interface XpResult {
  pokemon: Pokemon;
  levelUps: LevelUp[];
}

/** New moves are learned (all moves are kept: there is no 4-move limit, only the two special slots). */
function learn(p: Pokemon, slugs: readonly string[]): Pokemon {
  const fresh = slugs.filter(slug => !p.moves.includes(slug));
  return fresh.length ? { ...p, moves: [...p.moves, ...fresh] } : p;
}

/** HP goes up by as much as max HP does (a hurt Pokémon stays hurt by the same amount). */
function keepHpDifference(before: Pokemon, after: Pokemon): Pokemon {
  if (before.hp === 0) return after;
  return { ...after, hp: Math.max(1, before.hp + maxHpOf(after) - maxHpOf(before)) };
}

/** Adds XP: levels up as many times as it reaches, learning the moves of each new level. Fainted Pokémon get none. */
export function gainXp(pokemon: Pokemon, amount: number): XpResult {
  if (pokemon.hp === 0 || amount <= 0 || pokemon.level >= MAX_LEVEL) return { pokemon, levelUps: [] };
  const s = species(pokemon.speciesId);
  const cap = xpForLevel(s.growthRate, MAX_LEVEL);
  let p: Pokemon = { ...pokemon, xp: Math.min(cap, pokemon.xp + amount) };
  const target = levelForXp(s.growthRate, p.xp);
  const levelUps: LevelUp[] = [];
  for (let level = pokemon.level + 1; level <= target; level++) {
    const moves = learnable(s).filter(entry => entry.level === level).map(entry => entry.move);
    const before = p;
    p = learn({ ...p, level }, moves);
    p = keepHpDifference(before, p);
    levelUps.push({ level, moves: moves.filter(m => !before.moves.includes(m)) });
  }
  return { pokemon: p, levelUps };
}

/**
 * A Rare Candy: exactly one level (its XP set to the start of the next level), learning that level's moves. Not for a
 * fainted Pokémon, nor one at the top level (null then).
 */
export function useRareCandy(pokemon: Pokemon): XpResult | null {
  if (pokemon.hp === 0 || pokemon.level >= MAX_LEVEL) return null;
  const s = species(pokemon.speciesId);
  return gainXp(pokemon, xpForLevel(s.growthRate, pokemon.level + 1) - pokemon.xp);
}

/** A level evolution this Pokémon has reached (stones and trades: itemEvolution). */
export function levelEvolution(pokemon: Pokemon): Evolution | null {
  if (pokemon.hp === 0) return null;
  return species(pokemon.speciesId).evolutions.find(e => e.kind === 'level' && pokemon.level >= e.level) ?? null;
}

/**
 * An evolution this item starts: a stone for stone evolutions, the Link Cable for every trade evolution (holding an
 * item or not), the Soothe Bell for friendship evolutions (decided: trading and friendship become items). Fainted
 * Pokémon can't evolve.
 */
export function itemEvolution(pokemon: Pokemon, item: EvolutionItemId): Evolution | null {
  if (pokemon.hp === 0) return null;
  const starts = (e: Evolution) => {
    if (item === 'link-cable') return e.kind === 'trade';
    if (item === 'soothe-bell') return e.kind === 'friendship';
    return e.kind === 'item' && e.item === item;
  };
  return species(pokemon.speciesId).evolutions.find(starts) ?? null;
}

export interface EvolveResult {
  pokemon: Pokemon;
  /** Moves the new form learns at its current level. */
  moves: string[];
}

/**
 * Evolving: new species, new stats (HP up by the difference), same moves and specials, plus every move the new form
 * would know at this level that this Pokémon doesn't (its Lv. 1 moves, and any it learns earlier than the old form did).
 * Nothing is ever forgotten (no 4-move limit here).
 */
export function evolve(pokemon: Pokemon, to: number): EvolveResult {
  const next = species(to);
  const moves = learnable(next).filter(entry => entry.level <= pokemon.level).map(entry => entry.move);
  const evolved = learn({ ...pokemon, speciesId: to }, moves);
  return { pokemon: keepHpDifference(pokemon, evolved), moves: moves.filter(m => !pokemon.moves.includes(m)) };
}

/** The moves that can go in a special slot: known damaging moves (or Struggle, for a Pokémon that has none). */
export function specialOptions(pokemon: Pokemon): string[] {
  const damaging = pokemon.moves.filter(isDamaging);
  return damaging.length > 0 ? damaging : [STRUGGLE];
}

export function setSpecial(pokemon: Pokemon, slot: 'elemental' | 'big', move: string): Pokemon {
  if (!specialOptions(pokemon).includes(move)) throw new Error(`${move} can't be a special for this Pokémon`);
  return { ...pokemon, specials: { ...pokemon.specials, [slot]: move } };
}

/** Back to full HP (the Pokémon Center, later; the sandbox's Heal button for now). */
export const heal = (pokemon: Pokemon): Pokemon => ({ ...pokemon, hp: maxHpOf(pokemon) });
