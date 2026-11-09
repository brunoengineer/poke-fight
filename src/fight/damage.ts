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

/**
 * The big special (decided after milestone 13: it spends the whole PP bar, yet the formula made it hit like an
 * elemental special): a share of the defender's max HP, about half of it between equals (45%, ×1.1 with the same-type
 * bonus). Types, levels, stats and the move's power still count, softened (square roots, clamped), and the total
 * stays between 12% and 75% (never a knockout from full HP). A guard keeps out all but 45% of it (≈ 20%); a parry, all
 * of it. Combo scaling doesn't apply.
 */
export const BIG_DAMAGE = { share: 0.45, stab: 1.1, min: 0.12, max: 0.75, guardKeeps: 0.45 };

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

/** The big special's damage, from the defender's base max HP (a boss's bar is several times it). */
export function bigDamage(attacker: Fighter, defender: Fighter, attack: AttackInfo, baseHp: number): DamageResult {
  const multiplier = attack.type ? effectiveness(attack.type, defender.types) : 1;
  if (multiplier === 0) return { damage: 0, effectiveness: 0 };
  const [a, d] = attack.category === 'physical' ? [attacker.stats.atk, defender.stats.def] : [attacker.stats.spa, defender.stats.spd];
  const stab = attack.type && attacker.types.includes(attack.type) ? BIG_DAMAGE.stab : 1;
  const share =
    BIG_DAMAGE.share *
    stab *
    Math.sqrt(multiplier) *
    clamp(attacker.level / defender.level, 0.5, 1.3) *
    clamp(Math.sqrt(a / d), 0.75, 1.3) *
    clamp(Math.sqrt(attack.power / 100), 0.8, 1.15);
  // A barrage's rock is a part of it.
  const damage = Math.round(baseHp * clamp(share, BIG_DAMAGE.min, BIG_DAMAGE.max) * (attack.part ?? 1));
  return { damage: Math.max(1, damage), effectiveness: multiplier };
}

/** Each hit in a combo does 10% less than the previous one, down to 40%. */
export const scaledDamage = (damage: number, comboHits: number) =>
  Math.floor((damage * Math.max(COMBO_SCALING.min, 100 - COMBO_SCALING.step * comboHits)) / 100);
