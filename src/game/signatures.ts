// Moves of their own (plan.md §4.9): the famous Pokémon's signature moves (back, down, forward + attack) and the
// legendaries' moves (down, down + attack). Data the fight reads through the Pokémon's loadout.

import { speciesBySlug } from '../data/pokedex';
import { REGIONS } from '../data/regions';
import { BOSS_ATTACK, isBossAttack, type BossAttackId } from '../fight/boss';
import type { BigShape } from '../fight/frame-data';
import type { Loadout } from '../fight/state';

/** A signature move's power (with the same-type bonus: every one is of its Pokémon's type): about an elemental's. */
export const SIGNATURE_POWER = 90;

/** Each one in a form of its own: no two of them alike. Names are moves' names (English, like the data's). */
export const SIGNATURES: Record<string, { name: string; type: string; category: 'physical' | 'special'; shape: BigShape }> = {
  pikachu: { name: 'Thunder', type: 'electric', category: 'special', shape: 'strike' },
  charizard: { name: 'Blast Burn', type: 'fire', category: 'special', shape: 'solar' },
  blaziken: { name: 'Blaze Kick', type: 'fire', category: 'physical', shape: 'tornado' },
  lucario: { name: 'Aura Sphere', type: 'fighting', category: 'special', shape: 'projectile' },
  gengar: { name: 'Night Shade', type: 'ghost', category: 'special', shape: 'burst' },
  gardevoir: { name: 'Psychic', type: 'psychic', category: 'special', shape: 'beam' },
  kingler: { name: 'Crabhammer', type: 'water', category: 'physical', shape: 'surf' },
  dragonite: { name: 'Draco Meteor', type: 'dragon', category: 'special', shape: 'barrage' },
  lapras: { name: 'Sheer Cold', type: 'ice', category: 'special', shape: 'blizzard' },
  flygon: { name: 'Earth Power', type: 'ground', category: 'special', shape: 'quake' },
  garchomp: { name: 'Dragon Rush', type: 'dragon', category: 'physical', shape: 'rush' },
};

/** A legendary's boss attack, cut down to a player's move: the big special form closest to it. */
export const LEGEND_FORMS: Record<BossAttackId, BigShape> = {
  slash: 'surf',
  nova: 'burst',
  meteor: 'barrage',
  quake: 'quake',
  rampage: 'rush',
  vortex: 'tornado',
};

const BY_ID = new Map(Object.entries(SIGNATURES).map(([slug, s]) => [speciesBySlug(slug).id, s]));

/** Every sanctuary's legendaries: species id → its first boss attack. */
const LEGENDS = new Map(
  REGIONS.flatMap(r => r.sanctuary.legendaries).flatMap(l => {
    const attack = l.attacks.find(isBossAttack);
    return attack ? [[speciesBySlug(l.species).id, attack] as const] : [];
  }),
);

export function signatureOf(speciesId: number): Loadout['signature'] {
  const s = BY_ID.get(speciesId);
  return s ? { ...s, power: SIGNATURE_POWER } : undefined;
}

export function legendOf(speciesId: number, types: readonly string[]): Loadout['legend'] {
  const attack = LEGENDS.get(speciesId);
  return attack ? { attack, type: types[0], category: BOSS_ATTACK[attack].category, shape: LEGEND_FORMS[attack] } : undefined;
}
