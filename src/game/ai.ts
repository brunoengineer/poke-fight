// Who plays the opponent's Pokémon, and how well: each opponent Pokémon gets its own CPU profile.
//
//   - Who controls it sets the base skill: a wild Pokémon is clumsy (below easy); a trainer's Pokémon plays at the
//     trainer's difficulty (the battle field: normal; gyms and the League: their own).
//   - An evolved Pokémon has fought more: each evolution stage adds skill, and so does its level.
//   - Its style comes from its stats (a fast hitter rushes in, a special attacker keeps away, a wall waits), unless a
//     gym leader or League member sets one for the whole team.
//   - Every Pokémon gets a small random twist on its personality, so two Pidgeys don't fight the same way.

import { hasSpecies, species, type BaseStats } from '../data/pokedex';
import { makeProfile, personalityOf, SKILL_OF, skillAt, type AiProfile, type Difficulty, type Personality, type Style } from '../fight/ai/profiles';
import type { Rng } from '../engine/rng';

export type Controller = { kind: 'wild' } | { kind: 'trainer'; difficulty: Difficulty; style?: Style };

/** What the profile needs to know about a Pokémon (an owned Pokémon or a team member both have it). */
export interface Opponent {
  speciesId: number | null;
  level: number;
}

/** Skill per evolution stage, and at level 100 (proportionally below). */
export const STAGE_SKILL = 0.1;
export const LEVEL_SKILL = 0.12;
/** A trainer's basic, low-level Pokémon plays a little below the trainer's difficulty; evolving makes up for it. */
const TRAINER_START = -0.1;

/** 0 for a basic Pokémon, 1 after one evolution, 2 after two. */
export function evolutionStage(speciesId: number): number {
  let stage = 0;
  let s = species(speciesId);
  while (s.evolvesFrom !== null && hasSpecies(s.evolvesFrom)) {
    stage++;
    s = species(s.evolvesFrom);
  }
  return stage;
}

/** The fighting style its base stats suggest. */
export function styleOf(stats: BaseStats): Style {
  const bulk = (stats.def + stats.spd) / 2;
  const attack = Math.max(stats.atk, stats.spa);
  if (stats.spa >= stats.atk * 1.2) return 'zoner';
  if (bulk >= attack * 1.2) return 'defensive';
  if (stats.atk >= stats.spa && stats.spe >= 70) return 'aggressive';
  return 'balanced';
}

export function skillOf(pokemon: Opponent, controller: Controller): number {
  const base = controller.kind === 'wild' ? 0 : SKILL_OF[controller.difficulty] + TRAINER_START;
  const stage = pokemon.speciesId === null ? 0 : evolutionStage(pokemon.speciesId);
  return Math.min(1, Math.max(0, base + stage * STAGE_SKILL + (pokemon.level / 100) * LEVEL_SKILL));
}

/** How far each personality number may drift (±), per Pokémon. */
export const TWIST = 0.2;

export function cpuProfile(pokemon: Opponent, controller: Controller, rng: Rng): AiProfile {
  const style = (controller.kind === 'trainer' ? controller.style : undefined) ?? (pokemon.speciesId === null ? 'balanced' : styleOf(species(pokemon.speciesId).stats));
  const personality = personalityOf(style);
  const twisted = Object.fromEntries(
    (Object.entries(personality) as [keyof Personality, number][]).map(([key, value]) => [key, Math.min(1, Math.max(0, value * (1 - TWIST + rng.next() * 2 * TWIST)))]),
  ) as unknown as Personality;
  const skill = skillOf(pokemon, controller);
  return { ...makeProfile('normal', style), ...skillAt(skill), ...twisted, name: `${controller.kind === 'wild' ? 'wild' : 'trainer'} ${skill.toFixed(2)} ${style}` };
}
