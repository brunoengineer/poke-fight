// A Pokémon the player (or an opponent) owns, and how it becomes a fighter.

import { move, species, type Species } from '../data/pokedex';
import { HP_UNITS } from '../fight/constants';
import type { FighterSetup, Loadout } from '../fight/state';
import { bigShape, defaultSpecials, elementalShape, movesKnownAt, type SpecialChoice } from './moves';
import { mobility, statsAt, uniformIvs, type Stats } from './stats';
import { xpForLevel } from './xp';
import { legendOf, signatureOf } from './signatures';

export interface Pokemon {
  speciesId: number;
  level: number;
  /** Total experience (the level follows from it and the species' growth rate). */
  xp: number;
  ivs: Stats;
  /** Current HP in fight units (HP_UNITS per real HP). */
  hp: number;
  /** Every move it knows (move slugs, in learning order). */
  moves: string[];
  /** The moves in its two special slots. */
  specials: SpecialChoice;
}

export interface CreateOptions {
  ivs?: Stats;
  /** Moves taught on top of the learnset (the Professor's gift to the starters). */
  gifts?: readonly string[];
}

export function createPokemon(speciesId: number, level: number, options: CreateOptions = {}): Pokemon {
  const s = species(speciesId);
  const ivs = options.ivs ?? uniformIvs();
  const moves = movesKnownAt(s, level, options.gifts);
  return {
    speciesId,
    level,
    xp: xpForLevel(s.growthRate, level),
    ivs,
    hp: statsAt(s.stats, level, ivs).hp * HP_UNITS,
    moves,
    specials: defaultSpecials(s, moves),
  };
}

export const statsOf = (p: Pokemon): Stats => statsAt(species(p.speciesId).stats, p.level, p.ivs);
export const maxHpOf = (p: Pokemon): number => statsOf(p).hp * HP_UNITS;
/** Real HP, as menus show it. */
export const displayHp = (fightHp: number) => Math.ceil(fightHp / HP_UNITS);

function slot<T extends 'elemental' | 'big'>(slug: string, which: T): Loadout[T] {
  const m = move(slug);
  const category = m.category === 'physical' ? 'physical' : 'special';
  const shape = which === 'elemental' ? elementalShape(slug) : bigShape(slug);
  return { name: m.name, type: m.type, power: m.power ?? 0, category, shape } as Loadout[T];
}

export function loadoutOf(p: Pokemon): Loadout {
  const signature = signatureOf(p.speciesId);
  const legend = legendOf(p.speciesId, species(p.speciesId).types);
  return {
    elemental: slot(p.specials.elemental, 'elemental'),
    big: slot(p.specials.big, 'big'),
    // Only the Pokémon that have one get the key (everyone else's loadout stays exactly as it was).
    ...(signature ? { signature } : {}),
    ...(legend ? { legend } : {}),
  };
}

/** Everything the fight needs from this Pokémon (PP is the fight's own: each Pokémon enters with half a bar). */
export function toFighter(p: Pokemon): Omit<FighterSetup, 'pp'> {
  const s: Species = species(p.speciesId);
  const { hp, ...stats } = statsOf(p);
  return {
    speciesId: p.speciesId,
    name: s.name,
    types: [...s.types],
    level: p.level,
    stats,
    mobility: mobility(s.stats.spe),
    maxHp: hp * HP_UNITS,
    hp: p.hp,
    loadout: loadoutOf(p),
  };
}
