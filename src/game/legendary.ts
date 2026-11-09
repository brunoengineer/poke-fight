// The Legendary Sanctuary's rules (decided after milestone 11):
//   - a legendary fights with four times its HP and its own boss attacks (fight/boss.ts), so it takes the whole team;
//   - it is strong: its level is its region's, with the best individual values;
//   - only a Master Ball can catch it (no other ball can even be tried);
//   - beating it gives the whole party a lot of XP (rewards.ts LEGENDARY_XP).

import type { BallId } from '../data/items';
import { speciesBySlug } from '../data/pokedex';
import type { Legendary } from '../data/regions/types';
import type { TeamMember } from '../fight/battle';
import { BOSS_HP_MULTIPLIER, isBossAttack, makeBoss } from '../fight/boss';
import { createPokemon, toFighter, type Pokemon } from './pokemon';
import { uniformIvs } from './stats';

/** How many times its normal HP a legendary fights with. */
export const LEGENDARY_HP = BOSS_HP_MULTIPLIER;

/** The legendary as a Pokémon (what is caught): its normal stats, the best individual values. */
export function legendaryPokemon(l: Legendary): Pokemon {
  return createPokemon(speciesBySlug(l.species).id, l.level, { ivs: uniformIvs(31) });
}

/** The legendary as a fighter: four times the HP, and its boss attacks. */
export function legendaryFighter(l: Legendary): TeamMember {
  return makeBoss(toFighter(legendaryPokemon(l)), l.attacks.filter(isBossAttack));
}

/** Which balls can be thrown: anything at a wild Pokémon, only the Master Ball at a legendary. */
export const canThrowAt = (ball: BallId, legendary: boolean) => !legendary || ball === 'master-ball';
