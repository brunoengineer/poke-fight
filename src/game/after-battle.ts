// After a battle: HP carries over, XP is shared out, Pokémon level up and learn moves, and some are ready to evolve.
// Pure: returns the new party and a report for the results screen (evolutions are asked one at a time by the UI).

import { species } from '../data/pokedex';
import type { BattleState } from '../fight/battle';
import { gainXp, levelEvolution } from './progress';
import type { Pokemon } from './pokemon';
import { battleXp } from './rewards';
import { MAX_LEVEL, xpForLevel } from './xp';

export type ReportLine =
  | { kind: 'xp'; index: number; amount: number }
  | { kind: 'level'; index: number; level: number }
  | { kind: 'move'; index: number; move: string };

/** One Pokémon's XP for the results screen: how far its bar was, and how far it is now (0–1 of the level). */
export interface XpGain {
  index: number;
  amount: number;
  levelFrom: number;
  levelTo: number;
  progressFrom: number;
  progressTo: number;
  moves: string[];
}

export interface BattleReport {
  outcome: 'win' | 'loss' | 'draw';
  lines: ReportLine[];
  gains: XpGain[];
  /** Party indexes ready to evolve by level (asked in order). */
  evolutions: { index: number; to: number }[];
}

/** The battle's player team must be the party, in the same order (that's how battles are built from it). */
export function afterBattle(party: readonly Pokemon[], battle: BattleState, trainer: boolean): { party: Pokemon[]; report: BattleReport } {
  let next = party.map((p, i) => ({ ...p, hp: battle.teams[0][i]?.hp ?? p.hp }));
  const lines: ReportLine[] = [];
  const gains: XpGain[] = [];
  for (const [index, amount] of battleXp(battle, trainer)) {
    const before = next[index];
    const result = gainXp(before, amount);
    next = next.map((p, i) => (i === index ? result.pokemon : p));
    lines.push({ kind: 'xp', index, amount });
    for (const up of result.levelUps) {
      lines.push({ kind: 'level', index, level: up.level });
      for (const move of up.moves) lines.push({ kind: 'move', index, move });
    }
    gains.push({
      index,
      amount,
      levelFrom: before.level,
      levelTo: result.pokemon.level,
      progressFrom: levelProgress(before),
      progressTo: levelProgress(result.pokemon),
      moves: result.levelUps.flatMap(up => up.moves),
    });
  }
  const evolutions = next.flatMap((p, index) => {
    const evolution = levelEvolution(p);
    return evolution ? [{ index, to: evolution.to }] : [];
  });
  const outcome = battle.winner === 0 ? 'win' : battle.winner === 1 ? 'loss' : 'draw';
  return { party: next, report: { outcome, lines, gains, evolutions } };
}

/** How far a Pokémon is into its level (0–1; a Pokémon at the last level is full). */
export function levelProgress(p: Pokemon): number {
  if (p.level >= MAX_LEVEL) return 1;
  const rate = species(p.speciesId).growthRate;
  const from = xpForLevel(rate, p.level);
  const to = xpForLevel(rate, p.level + 1);
  return Math.max(0, Math.min(1, (p.xp - from) / (to - from)));
}
