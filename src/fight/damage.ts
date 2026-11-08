// Damage: the official formula (Gen 3+), with STAB and the type chart, scaled for the fight. No random roll: a fighting
// game should be precise, so the same hit always does the same damage.

import { effectiveness } from '../data/types';
import { COMBO_SCALING, DAMAGE_SCALE, HP_UNITS } from './constants';
import type { AttackInfo, Fighter } from './state';

export interface DamageResult {
  /** In fight HP units. */
  damage: number;
  /** Type multiplier: 0, ¼, ½, 1, 2 or 4. */
  effectiveness: number;
}

/** Same-type attack bonus. */
export const STAB = 1.5;

export function computeDamage(attacker: Fighter, defender: Fighter, attack: AttackInfo): DamageResult {
  const multiplier = attack.type ? effectiveness(attack.type, defender.types) : 1;
  if (multiplier === 0) return { damage: 0, effectiveness: 0 };
  const [a, d] = attack.category === 'physical' ? [attacker.stats.atk, defender.stats.def] : [attacker.stats.spa, defender.stats.spd];
  const base = Math.floor(Math.floor(Math.floor((2 * attacker.level) / 5 + 2) * attack.power * a / d) / 50) + 2;
  const stab = attack.type && attacker.types.includes(attack.type) ? STAB : 1;
  const damage = Math.max(1, Math.floor(base * stab * multiplier * DAMAGE_SCALE * HP_UNITS));
  return { damage, effectiveness: multiplier };
}

/** Each hit in a combo does 10% less than the previous one, down to 40%. */
export const scaledDamage = (damage: number, comboHits: number) =>
  Math.floor((damage * Math.max(COMBO_SCALING.min, 100 - COMBO_SCALING.step * comboHits)) / 100);
