// Growing: XP, level ups (stats and new moves), evolution and choosing specials. Pure: each function returns a new
// Pokémon and never changes the one it was given.

import { species, type Evolution } from '../data/pokedex';
import { isDamaging, STRUGGLE } from './moves';
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
    const moves = s.learnset.filter(entry => entry.level === level).map(entry => entry.move);
    const before = p;
    p = learn({ ...p, level }, moves);
    p = keepHpDifference(before, p);
    levelUps.push({ level, moves: moves.filter(m => !before.moves.includes(m)) });
  }
  return { pokemon: p, levelUps };
}

/** A level evolution this Pokémon has reached (stones and trades come with the shop, milestone 8). */
export function levelEvolution(pokemon: Pokemon): Evolution | null {
  if (pokemon.hp === 0) return null;
  return species(pokemon.speciesId).evolutions.find(e => e.kind === 'level' && pokemon.level >= e.level) ?? null;
}

export interface EvolveResult {
  pokemon: Pokemon;
  /** Moves the new form learns at its current level. */
  moves: string[];
}

/** Evolves: new species, new stats (HP up by the difference), same moves and specials, plus its moves at this level. */
export function evolve(pokemon: Pokemon, to: number): EvolveResult {
  const next = species(to);
  const moves = next.learnset.filter(entry => entry.level === pokemon.level).map(entry => entry.move);
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
