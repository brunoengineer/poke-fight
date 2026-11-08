// After a battle: HP carries over, XP is shared out, Pokémon level up and learn moves, and some are ready to evolve.
// Pure: returns the new party and a report for the results screen (evolutions are asked one at a time by the UI).

import type { BattleState } from '../fight/battle';
import { gainXp, levelEvolution } from './progress';
import type { Pokemon } from './pokemon';
import { battleXp } from './rewards';

export type ReportLine =
  | { kind: 'xp'; index: number; amount: number }
  | { kind: 'level'; index: number; level: number }
  | { kind: 'move'; index: number; move: string };

export interface BattleReport {
  outcome: 'win' | 'loss' | 'draw';
  lines: ReportLine[];
  /** Party indexes ready to evolve by level (asked in order). */
  evolutions: { index: number; to: number }[];
}

/** The battle's player team must be the party, in the same order (that's how battles are built from it). */
export function afterBattle(party: readonly Pokemon[], battle: BattleState, trainer: boolean): { party: Pokemon[]; report: BattleReport } {
  let next = party.map((p, i) => ({ ...p, hp: battle.teams[0][i]?.hp ?? p.hp }));
  const lines: ReportLine[] = [];
  for (const [index, amount] of battleXp(battle, trainer)) {
    const result = gainXp(next[index], amount);
    next = next.map((p, i) => (i === index ? result.pokemon : p));
    lines.push({ kind: 'xp', index, amount });
    for (const up of result.levelUps) {
      lines.push({ kind: 'level', index, level: up.level });
      for (const move of up.moves) lines.push({ kind: 'move', index, move });
    }
  }
  const evolutions = next.flatMap((p, index) => {
    const evolution = levelEvolution(p);
    return evolution ? [{ index, to: evolution.to }] : [];
  });
  const outcome = battle.winner === 0 ? 'win' : battle.winner === 1 ? 'loss' : 'draw';
  return { party: next, report: { outcome, lines, evolutions } };
}
