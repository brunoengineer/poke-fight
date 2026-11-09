// The fight lab's core (docs/fight-lab.md): one fight between two CPUs, start to finish, with everything that
// happened in it counted. Pure and deterministic: the same sides and seed always play the same fight, so any
// experiment can be run again and any change measured against the old numbers.

import { cpuStep, createCpu } from '../fight/ai/cpu';
import type { AiProfile } from '../fight/ai/profiles';
import type { TeamMember } from '../fight/battle';
import { createFight, type FightState, type HitSource } from '../fight/state';
import { step } from '../fight/step';

/** One side of a duel: a Pokémon (as the fight sees it) and the CPU that plays it. */
export interface Side {
  fighter: TeamMember;
  profile: AiProfile;
}

export const SOURCES: readonly HitSource[] = ['tackle', 'air', 'elemental', 'big', 'boss'];

/** What one side did in a fight. */
export interface SideStats {
  /** Damage dealt, in all and by what landed it. */
  damage: number;
  bySource: Record<HitSource, number>;
  /** Hits landed by what landed them (a special's landed rate: these over specials used). */
  hitsBySource: Record<HitSource, number>;
  /** The extra damage from bonuses (back attacks, counters). */
  bonusDamage: number;
  hits: number;
  /** Its hits the opponent guarded, and the chip damage that went through anyway. */
  blocked: number;
  chip: number;
  /** Hits it parried, and the bonus hits it landed. */
  parries: number;
  backAttacks: number;
  counters: number;
  specials: { elemental: number; big: number };
  dashes: number;
  dashThroughs: number;
  jumps: number;
  /** HP left at the end, 0–1. */
  hpLeft: number;
}

export interface DuelResult {
  winner: 0 | 1 | 'draw';
  frames: number;
  timeOver: boolean;
  sides: [SideStats, SideStats];
  /**
   * The largest HP lead (as a fraction of the bar, 0–1) the loser ever had over the winner: a comeback is a win from
   * behind (0 when the winner was never behind; nothing for a draw).
   */
  overcame: number;
}

const emptySide = (): SideStats => ({
  damage: 0,
  bySource: { tackle: 0, air: 0, elemental: 0, big: 0, boss: 0 },
  hitsBySource: { tackle: 0, air: 0, elemental: 0, big: 0, boss: 0 },
  bonusDamage: 0,
  hits: 0,
  blocked: 0,
  chip: 0,
  parries: 0,
  backAttacks: 0,
  counters: 0,
  specials: { elemental: 0, big: 0 },
  dashes: 0,
  dashThroughs: 0,
  jumps: 0,
  hpLeft: 1,
});

/** A fight never lasts longer than the round timer (99 s); this is a safety net. */
const MAX_FRAMES = 99 * 60 + 600;

/** One fight, CPU against CPU, from the round's first frame to its end. */
export function duel(a: Side, b: Side, seed: number, start?: (state: FightState) => void): DuelResult {
  let state = createFight({ fighters: [a.fighter, b.fighter] });
  start?.(state);
  let cpus = [createCpu(0, a.profile, seed * 2 + 1), createCpu(1, b.profile, seed * 2 + 2)] as const;
  const sides: [SideStats, SideStats] = [emptySide(), emptySide()];
  // HP lead of side 0 over side 1 (fractions of the bar), at its most each way.
  let lead0 = 0;
  let lead1 = 0;

  while (state.winner === null && state.frame < MAX_FRAMES) {
    const before = state;
    const r0 = cpuStep(cpus[0], state);
    const r1 = cpuStep(cpus[1], state);
    cpus = [r0.cpu, r1.cpu];
    const result = step(state, [r0.input, r1.input]);
    state = result.state;

    for (const e of result.events) {
      if (e.type === 'hit') {
        const s = sides[e.attacker];
        s.damage += e.damage;
        s.bySource[e.source] += e.damage;
        s.hitsBySource[e.source]++;
        s.hits++;
        if (e.bonus) {
          // The bonus multiplied the hit by 1.5: a third of it is the bonus.
          s.bonusDamage += Math.round(e.damage / 3);
          if (e.bonus === 'back') s.backAttacks++;
          else s.counters++;
        }
      } else if (e.type === 'block') {
        sides[e.attacker].blocked++;
        sides[e.attacker].chip += e.chip;
        sides[e.attacker].damage += e.chip;
        sides[e.attacker].bySource[e.source] += e.chip;
      } else if (e.type === 'parry') {
        sides[e.defender].parries++;
      } else if (e.type === 'special') {
        sides[e.fighter].specials[e.slot]++;
      }
    }
    for (const f of state.fighters) {
      const was = before.fighters[f.id];
      if (f.action === 'dash' && was.action !== 'dash') sides[f.id].dashes++;
      if (f.action === 'prejump' && was.action !== 'prejump') sides[f.id].jumps++;
      if (f.bonus?.kind === 'back' && was.bonus?.kind !== 'back') sides[f.id].dashThroughs++;
    }
    const [f0, f1] = state.fighters;
    const lead = f0.hp / f0.maxHp - f1.hp / f1.maxHp;
    lead0 = Math.max(lead0, lead);
    lead1 = Math.max(lead1, -lead);
  }

  for (const f of state.fighters) sides[f.id].hpLeft = f.hp / f.maxHp;
  const winner = state.winner ?? 'draw';
  return {
    winner,
    frames: state.frame,
    timeOver: state.timeOver,
    sides,
    overcame: winner === 0 ? lead1 : winner === 1 ? lead0 : 0,
  };
}
