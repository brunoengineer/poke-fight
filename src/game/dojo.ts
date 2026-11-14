// The Training Dojo (plan.md §5, decided 2026-11-14): in each region's League city, one Pokémon can be left to train.
// It gains a level for every battle the player fights in that region (won or lost; running away doesn't count), and
// comes back at any time for DOJO_FEE. One at a time per region: the dojo is part of the region's journey.
// Pure: every function returns new values.

import { species } from '../data/pokedex';
import { MAX_PARTY } from './box';
import type { Pokemon } from './pokemon';
import { gainXp, heal, type LevelUp } from './progress';
import { MAX_LEVEL, xpForLevel } from './xp';

export const DOJO_FEE = 2000;

export interface Dojo {
  /** The Pokémon as it was left (healed). */
  pokemon: Pokemon;
  /** Battles fought since: one level each (never counted past Lv. 100). */
  battles: number;
}

/** Leaves a party Pokémon at the dojo: healed, and out of the party. The party keeps at least one. */
export function leaveAtDojo(party: readonly Pokemon[], index: number, dojo: Dojo | null): { party: Pokemon[]; dojo: Dojo } {
  if (dojo) throw new Error('The dojo already has a Pokémon');
  if (party.length < 2) throw new Error('The party must keep a Pokémon');
  const pokemon = party[index];
  if (!pokemon) throw new Error(`No party Pokémon ${index}`);
  return { party: party.filter((_, i) => i !== index), dojo: { pokemon: heal(pokemon), battles: 0 } };
}

/** One battle fought in the dojo's region: one more level for its Pokémon (none past Lv. 100). */
export function trainOnce(dojo: Dojo): Dojo {
  return dojo.pokemon.level + dojo.battles >= MAX_LEVEL ? dojo : { ...dojo, battles: dojo.battles + 1 };
}

/** The Pokémon as it is now: its levels gained, with their moves, at full HP. */
export function trained(dojo: Dojo): { pokemon: Pokemon; levelUps: LevelUp[] } {
  const target = Math.min(MAX_LEVEL, dojo.pokemon.level + dojo.battles);
  if (target === dojo.pokemon.level) return { pokemon: heal(dojo.pokemon), levelUps: [] };
  const s = species(dojo.pokemon.speciesId);
  const { pokemon, levelUps } = gainXp(heal(dojo.pokemon), xpForLevel(s.growthRate, target) - dojo.pokemon.xp);
  return { pokemon: heal(pokemon), levelUps };
}

export type TakeBack =
  | { ok: true; money: number; party: Pokemon[]; box: Pokemon[]; where: 'party' | 'box'; pokemon: Pokemon; levelUps: LevelUp[] }
  | { ok: false; reason: 'empty' | 'money' };

/** Takes the Pokémon back for DOJO_FEE: to the party, or to the box when the party is full. */
export function takeBack(money: number, party: readonly Pokemon[], box: readonly Pokemon[], dojo: Dojo | null): TakeBack {
  if (!dojo) return { ok: false, reason: 'empty' };
  if (money < DOJO_FEE) return { ok: false, reason: 'money' };
  const { pokemon, levelUps } = trained(dojo);
  const toParty = party.length < MAX_PARTY;
  return {
    ok: true,
    money: money - DOJO_FEE,
    party: toParty ? [...party, pokemon] : [...party],
    box: toParty ? [...box] : [...box, pokemon],
    where: toParty ? 'party' : 'box',
    pokemon,
    levelUps,
  };
}
