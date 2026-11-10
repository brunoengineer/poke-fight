// Gyms (plan.md §3): the leader's team, what beating them pays, and who can challenge them.

import { RODS } from '../data/items';
import { species, speciesBySlug } from '../data/pokedex';
import type { Gym, Region } from '../data/regions';
import { createRng } from '../engine/rng';
import { encounterTable, tableForAreas } from './encounters';
import { createPokemon, type Pokemon } from './pokemon';

/** Every region has 8 gyms. */
export const BADGE_COUNT = 8;

export function gymTeam(gym: Gym): Pokemon[] {
  return gym.team.map(([slug, level]) => createPokemon(speciesBySlug(slug).id, level));
}

/** Leaders pay 99 × the level of their strongest Pokémon (as in Red/Blue: Brock pays ₽1386). */
export const LEADER_PRIZE = 99;
export const leaderPrize = (gym: Gym) => LEADER_PRIZE * Math.max(...gym.team.map(([, level]) => level));

/** A gym can be challenged once the player has the badges it needs, and only until it's beaten. */
export const canChallenge = (gym: Gym, badges: readonly string[]) => !badges.includes(gym.badge) && badges.length >= gym.badges;

// ── Gym trainers (decided 2026-11-10) ───────────────────────────────────────────────────────────────────────────
// Two trainers stand before each leader, fought in a row with the leader: no Pokémon Center in between, so HP carries
// over and potions matter. Their teams are a rule, not data: two Pokémon each of the gym's type, from the region's wild
// ones that fit their level, picked the same way every time for a gym.

/** Gym trainers and the leader: three battles. */
export const GYM_BATTLES = 3;
export const GYM_TRAINER_TEAM = 2;
/** Each trainer's level, below the leader's weakest Pokémon. */
export const GYM_TRAINER_LEVELS = [4, 2] as const;

/** Their trainer classes by type (the sprites the battle field uses too). */
const CLASSES: Record<string, [string, string]> = {
  normal: ['youngster', 'lass'],
  fire: ['camper', 'acetrainer'],
  water: ['swimmerf', 'fisherman'],
  grass: ['picnicker', 'lass'],
  electric: ['juggler', 'gentleman'],
  ice: ['acetrainerf', 'swimmerf'],
  fighting: ['blackbelt', 'acetrainer'],
  poison: ['juggler', 'picnicker'],
  ground: ['hiker', 'camper'],
  flying: ['birdkeeper', 'acetrainerf'],
  psychic: ['beauty', 'gentleman'],
  bug: ['bugcatcher', 'picnicker'],
  rock: ['hiker', 'camper'],
  ghost: ['beauty', 'juggler'],
  dragon: ['acetrainer', 'acetrainerf'],
  dark: ['juggler', 'acetrainer'],
  steel: ['hiker', 'gentleman'],
  fairy: ['beauty', 'lass'],
};

export interface GymTrainer {
  /** Its trainer class (a sprite, and a name: i18n trainerClass.<class>). */
  cls: string;
  team: Pokemon[];
}

/** The lowest level each species is met at in this region's wild (grass, caves, water, the Safari, the grove). */
function wildLevels(region: Region): Map<number, number> {
  const lowest = new Map<number, number>();
  for (const city of region.cities) {
    const tables = [
      ...(['grass', 'cave', 'rare'] as const).flatMap(kind => encounterTable(city, kind, null)),
      ...RODS.flatMap(rod => encounterTable(city, 'water', rod)),
      ...tableForAreas(city.safari ?? [], 'walk'),
    ];
    for (const e of tables) lowest.set(e.speciesId, Math.min(lowest.get(e.speciesId) ?? Infinity, e.minLevel));
  }
  return lowest;
}

/** The level a species evolves into at (from its pre-evolution), 0 when it doesn't evolve by level. */
function evolvedBy(id: number): number {
  const from = species(id).evolvesFrom;
  if (from === null) return 0;
  const e = species(from).evolutions.find(x => x.to === id);
  return e?.kind === 'level' ? e.level : 0;
}

const seedOf = (text: string) => [...text].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;

/**
 * The gym's two trainers. Their Pokémon: the gym's type, met in this region's wild at most 6 levels above the trainer's
 * and not below the level they evolve at (so an early gym's trainers don't bring evolved Pokémon), not the leader's own
 * species when there are enough others;
 * the closest fits first. If the region has too few of that type, any Pokémon of it up to its Pokédex (no legendaries).
 */
export function gymTrainers(gym: Gym, region: Region): GymTrainer[] {
  const leaderMin = Math.min(...gym.team.map(([, level]) => level));
  const leaderIds = new Set(gym.team.map(([slug]) => speciesBySlug(slug).id));
  const wild = wildLevels(region);
  const rng = createRng(seedOf(gym.badge));
  const classes = CLASSES[gym.type] ?? CLASSES.normal;
  const used = new Set<number>();
  return GYM_TRAINER_LEVELS.map((below, t) => {
    const level = Math.max(2, leaderMin - below);
    // Of the gym's type, and never below the level it evolves at (no Lv. 7 Gyarados).
    const ofType = (id: number) => species(id).types.includes(gym.type) && id <= region.lastSpecies && evolvedBy(id) <= level;
    let pool = [...wild.entries()].filter(([id, min]) => ofType(id) && min <= level + 6).map(([id]) => id);
    if (pool.filter(id => !leaderIds.has(id)).length >= GYM_TRAINER_TEAM) pool = pool.filter(id => !leaderIds.has(id));
    if (pool.length < GYM_TRAINER_TEAM) {
      pool = Array.from({ length: region.lastSpecies }, (_, i) => i + 1).filter(id => ofType(id) && !species(id).legendary && !species(id).mythical && species(id).evolvesFrom === null);
    }
    // Not the first trainer's Pokémon again, when there are enough.
    const fresh = pool.filter(id => !used.has(id));
    const choices = fresh.length >= GYM_TRAINER_TEAM ? fresh : pool;
    const team: Pokemon[] = [];
    const left = [...choices].sort((a, b) => a - b);
    while (team.length < GYM_TRAINER_TEAM && left.length > 0) {
      const id = left.splice(rng.int(left.length), 1)[0];
      used.add(id);
      team.push(createPokemon(id, level));
    }
    while (team.length < GYM_TRAINER_TEAM) team.push(createPokemon(team[0].speciesId, level));
    return { cls: classes[t], team };
  });
}
