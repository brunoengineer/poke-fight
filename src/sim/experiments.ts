// The fight lab's experiments (docs/fight-lab.md): each one plays many duels between CPUs and sums them up as
// tables (to read) and metrics (to save as a baseline and compare a change against).

import { makeProfile, STYLES, DIFFICULTIES, type AiProfile, type Difficulty, type Style } from '../fight/ai/profiles';
import type { TeamMember } from '../fight/battle';
import type { BigShape } from '../fight/frame-data';
import { createRng, type Rng } from '../engine/rng';
import { speciesBySlug } from '../data/pokedex';
import { createPokemon, toFighter } from '../game/pokemon';
import { duel, SOURCES, type DuelResult, type Side } from './duel';
import { mean, percent, quantile, rateText, wilson, type Rate } from './stats';

export interface Table {
  title: string;
  headers: string[];
  rows: string[][];
}

export interface Report {
  title: string;
  /** What the experiment asks, in a sentence. */
  question: string;
  tables: Table[];
  /** Flat numbers for baselines: a win rate keeps its interval. */
  metrics: Record<string, number | Rate>;
}

export interface Options {
  /** Duels per matchup. */
  n: number;
  seed: number;
  level: number;
}

/**
 * Fully evolved Pokémon of every type, the usual pool for duels: both sides get the same one (a mirror), so what is
 * measured is the CPUs or the rules, not a species matchup. A different one per duel, drawn by the seed.
 */
export const POOL = [
  'charizard', 'blastoise', 'venusaur', 'pikachu', 'alakazam', 'gengar', 'machamp', 'golem', 'lapras', 'snorlax',
  'dragonite', 'gyarados', 'scizor', 'tyranitar', 'ampharos', 'heracross', 'houndoom', 'blaziken', 'gardevoir',
  'metagross', 'flygon', 'garchomp', 'lucario', 'staraptor',
] as const;

const fighter = (slug: string, level: number): TeamMember => toFighter(createPokemon(speciesBySlug(slug).id, level));
const pick = <T>(rng: Rng, list: readonly T[]) => list[rng.int(list.length)];

/**
 * n duels between two profiles, mirror Pokémon from the pool. Side A plays player 1 in even duels and player 2 in
 * odd ones, so neither profile gets the starting side's (small) advantage.
 */
function series(
  a: AiProfile,
  b: AiProfile,
  o: Options,
  tweak?: (side: Side, which: 'a' | 'b') => void,
  pool: readonly string[] = POOL,
): { results: DuelResult[]; aWins: number; draws: number } {
  const rng = createRng(o.seed);
  const results: DuelResult[] = [];
  let aWins = 0;
  let draws = 0;
  for (let i = 0; i < o.n; i++) {
    const slug = pick(rng, pool);
    const sideA: Side = { fighter: fighter(slug, o.level), profile: a };
    const sideB: Side = { fighter: fighter(slug, o.level), profile: b };
    tweak?.(sideA, 'a');
    tweak?.(sideB, 'b');
    const aFirst = i % 2 === 0;
    const r = aFirst ? duel(sideA, sideB, o.seed * 100_003 + i) : duel(sideB, sideA, o.seed * 100_003 + i);
    // Results as seen from A (side 0 in the stats).
    const fromA: DuelResult = aFirst
      ? r
      : { ...r, winner: r.winner === 'draw' ? 'draw' : r.winner === 0 ? 1 : 0, sides: [r.sides[1], r.sides[0]] };
    results.push(fromA);
    if (fromA.winner === 0) aWins++;
    else if (fromA.winner === 'draw') draws++;
  }
  return { results, aWins, draws };
}

/** Win rate of A, draws counting as half a win. */
const winRate = (aWins: number, draws: number, n: number) => wilson(aWins + draws / 2, n);

// ── Experiments ───────────────────────────────────────────────────────────────────────────────────────────────────

/** Does each difficulty beat the one below it, and by how much? */
export function ladder(o: Options): Report {
  const metrics: Report['metrics'] = {};
  const rows = DIFFICULTIES.map(row =>
    [row, ...DIFFICULTIES.map(col => {
      if (row === col) return '—';
      const s = series(makeProfile(row), makeProfile(col), o);
      const rate = winRate(s.aWins, s.draws, o.n);
      metrics[`ladder.${row}_vs_${col}`] = rate;
      return rateText(rate);
    })],
  );
  return {
    title: 'Difficulty ladder',
    question: 'How often does each difficulty (row) beat each other one (column)? Mirror Pokémon, balanced style.',
    tables: [{ title: 'Row win rate (95% interval)', headers: ['', ...DIFFICULTIES], rows }],
    metrics,
  };
}

/** Is any style much stronger than the others (at one difficulty)? */
export function styles(o: Options, difficulty: Difficulty = 'hard'): Report {
  const metrics: Report['metrics'] = {};
  const overall: Record<Style, number[]> = { balanced: [], aggressive: [], defensive: [], zoner: [] };
  const cells = new Map<string, Rate>();
  STYLES.forEach((a, i) =>
    STYLES.forEach((b, j) => {
      if (j <= i) return;
      const s = series(makeProfile(difficulty, a), makeProfile(difficulty, b), o);
      const rate = winRate(s.aWins, s.draws, o.n);
      cells.set(`${a}:${b}`, rate);
      cells.set(`${b}:${a}`, { ...rate, p: 1 - rate.p, lo: 1 - rate.hi, hi: 1 - rate.lo });
      overall[a].push(rate.p);
      overall[b].push(1 - rate.p);
    }),
  );
  const rows = STYLES.map(a => [a, ...STYLES.map(b => (a === b ? '—' : rateText(cells.get(`${a}:${b}`)!))), percent(mean(overall[a]))]);
  for (const st of STYLES) metrics[`styles.${difficulty}.${st}`] = mean(overall[st]);
  return {
    title: `Styles at ${difficulty}`,
    question: 'Does any personality win too often? Each style (row) against each other one; the last column is its average.',
    tables: [{ title: 'Row win rate (95% interval)', headers: ['', ...STYLES, 'average'], rows }],
    metrics,
  };
}

/** Is the fight fair to both sides? Two identical CPUs: player 1 should win half the time. */
export function sides(o: Options, difficulty: Difficulty = 'hard'): Report {
  const p = makeProfile(difficulty);
  const rng = createRng(o.seed);
  let p1 = 0;
  let draws = 0;
  for (let i = 0; i < o.n; i++) {
    const slug = pick(rng, POOL);
    const r = duel({ fighter: fighter(slug, o.level), profile: p }, { fighter: fighter(slug, o.level), profile: p }, o.seed * 7919 + i);
    if (r.winner === 0) p1++;
    else if (r.winner === 'draw') draws++;
  }
  const rate = winRate(p1, draws, o.n);
  return {
    title: 'Side fairness',
    question: `Two identical ${difficulty} CPUs with the same Pokémon: does player 1 win about half the time?`,
    tables: [{ title: 'Player 1', headers: ['win rate (95% interval)', 'draws'], rows: [[rateText(rate), String(draws)]] }],
    metrics: { 'sides.p1': rate },
  };
}

/** How fights go: their length, what deals the damage, how often each mechanic is used, comebacks. */
export function mechanics(o: Options, difficulty: Difficulty = 'hard'): Report {
  const p = makeProfile(difficulty);
  const { results } = series(p, p, o);
  const seconds = results.map(r => r.frames / 60);
  const both = results.flatMap(r => r.sides);
  const total = both.reduce((s, x) => s + x.damage, 0) || 1;
  const bonus = both.reduce((s, x) => s + x.bonusDamage, 0);
  const share = SOURCES.map(src => [src, percent(both.reduce((s, x) => s + x.bySource[src], 0) / total, 1)]);
  const perSide = (f: (x: (typeof both)[number]) => number) => mean(both.map(f));
  const usage: [string, number][] = [
    ['hits landed', perSide(x => x.hits)],
    ['hits guarded', perSide(x => x.blocked)],
    ['parries', perSide(x => x.parries)],
    ['back attacks', perSide(x => x.backAttacks)],
    ['counters', perSide(x => x.counters)],
    ['elemental specials', perSide(x => x.specials.elemental)],
    ['big specials', perSide(x => x.specials.big)],
    ['dashes', perSide(x => x.dashes)],
    ['dashes through', perSide(x => x.dashThroughs)],
    ['jumps', perSide(x => x.jumps)],
  ];
  // How often a special lands when used (the rest is guarded, parried, jumped or missed).
  const landed = (slot: 'elemental' | 'big') =>
    wilson(
      both.reduce((s, x) => s + x.hitsBySource[slot], 0),
      Math.max(1, both.reduce((s, x) => s + x.specials[slot], 0)),
    );
  const elementalLanded = landed('elemental');
  const bigLanded = landed('big');
  const decided = results.filter(r => r.winner !== 'draw');
  const comebacks = wilson(decided.filter(r => r.overcame >= 0.5).length, decided.length);
  const timeOuts = results.filter(r => r.timeOver).length;
  const metrics: Report['metrics'] = {
    'mechanics.seconds.mean': mean(seconds),
    'mechanics.seconds.p50': quantile(seconds, 0.5),
    'mechanics.timeOuts': timeOuts / o.n,
    'mechanics.bonusShare': bonus / total,
    'mechanics.comebacks50': comebacks,
    'mechanics.elementalLanded': elementalLanded,
    'mechanics.bigLanded': bigLanded,
  };
  for (const [src, value] of share) metrics[`mechanics.share.${src}`] = Number.parseFloat(value) / 100;
  for (const [name, value] of usage) metrics[`mechanics.perFight.${name}`] = value;
  return {
    title: `Mechanics (${difficulty} vs ${difficulty})`,
    question: 'How long do fights last, what deals the damage, how often is each mechanic used, how often does the side behind win?',
    tables: [
      {
        title: 'Fight length',
        headers: ['mean', '10%', 'median', '90%', 'time-outs'],
        rows: [[`${mean(seconds).toFixed(1)} s`, `${quantile(seconds, 0.1).toFixed(1)} s`, `${quantile(seconds, 0.5).toFixed(1)} s`, `${quantile(seconds, 0.9).toFixed(1)} s`, percent(timeOuts / o.n)]],
      },
      { title: 'Damage by source (chip included)', headers: ['source', 'share'], rows: [...share, ['(of which bonus)', percent(bonus / total, 1)]] },
      { title: 'Per side, per fight', headers: ['what', 'average'], rows: usage.map(([name, value]) => [name, value.toFixed(2)]) },
      { title: 'Specials that land', headers: ['elemental', 'big'], rows: [[rateText(elementalLanded), rateText(bigLanded)]] },
      { title: 'Comebacks', headers: ['wins from 50%+ behind'], rows: [[rateText(comebacks)]] },
    ],
    metrics,
  };
}

const FORMS: readonly BigShape[] = ['projectile', 'beam', 'rush', 'quake', 'surf', 'tornado', 'solar', 'blizzard', 'burst', 'strike', 'barrage'];

/**
 * Is any big special's form much better than the others? Every form against every other, the Pokémon and its moves
 * otherwise identical (a Normal-type big special of power 100; no Ghost in the pool, which Normal can't touch).
 */
export function forms(o: Options, difficulty: Difficulty = 'hard'): Report {
  const p = makeProfile(difficulty);
  const wins: Record<string, number[]> = Object.fromEntries(FORMS.map(f => [f, []]));
  FORMS.forEach((a, i) =>
    FORMS.forEach((b, j) => {
      if (j <= i) return;
      const s = series(
        p,
        p,
        o,
        (side, which) => {
          const shape = which === 'a' ? a : b;
          side.fighter = { ...side.fighter, loadout: { ...side.fighter.loadout, big: { name: 'Test', type: 'normal', power: 100, category: category(shape), shape } } };
        },
        POOL.filter(slug => !speciesBySlug(slug).types.includes('ghost')),
      );
      const rate = winRate(s.aWins, s.draws, o.n).p;
      wins[a].push(rate);
      wins[b].push(1 - rate);
    }),
  );
  const ranked = [...FORMS].sort((x, y) => mean(wins[y]) - mean(wins[x]));
  const metrics: Report['metrics'] = {};
  for (const f of FORMS) metrics[`forms.${f}`] = mean(wins[f]);
  return {
    title: 'Big special forms',
    question: 'With everything else equal, how often does each form win against the others (its average win rate)?',
    tables: [{ title: `Average win rate (${o.n} duels per pair)`, headers: ['form', 'win rate'], rows: ranked.map(f => [f, percent(mean(wins[f]))]) }],
    metrics,
  };
}

const category = (shape: BigShape) => (shape === 'rush' ? 'physical' : 'special');

/** One species against another, both played by the same CPU. */
export function matchup(o: Options, a: string, b: string, difficulty: Difficulty = 'hard'): Report {
  const p = makeProfile(difficulty);
  let aWins = 0;
  let draws = 0;
  const results: DuelResult[] = [];
  for (let i = 0; i < o.n; i++) {
    const aFirst = i % 2 === 0;
    const sa = { fighter: fighter(a, o.level), profile: p };
    const sb = { fighter: fighter(b, o.level), profile: p };
    const r = aFirst ? duel(sa, sb, o.seed * 31 + i) : duel(sb, sa, o.seed * 31 + i);
    const aWon = aFirst ? r.winner === 0 : r.winner === 1;
    if (aWon) aWins++;
    else if (r.winner === 'draw') draws++;
    results.push(r);
  }
  const rate = winRate(aWins, draws, o.n);
  return {
    title: `${a} vs ${b} (Lv. ${o.level})`,
    question: `How often does ${a} beat ${b}, both played by a ${difficulty} CPU?`,
    tables: [
      {
        title: 'Result',
        headers: [`${a} win rate (95% interval)`, 'draws', 'mean length'],
        rows: [[rateText(rate), String(draws), `${mean(results.map(r => r.frames / 60)).toFixed(1)} s`]],
      },
    ],
    metrics: { [`matchup.${a}_vs_${b}`]: rate },
  };
}

/** The standard report: what to run before and after any change to the fight or the CPU. */
export const REPORT = ['sides', 'ladder', 'mechanics'] as const;
