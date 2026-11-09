// `npm run sim -- <experiment> [options]` (docs/fight-lab.md): runs experiments, prints them as markdown, saves their
// metrics as JSON, and compares them against a saved baseline.

import { readFileSync, writeFileSync } from 'node:fs';
import type { Difficulty } from '../fight/ai/profiles';
import { economy } from './economy';
import { forms, ladder, matchup, mechanics, REPORT, sides, styles, type Options, type Report, type Table } from './experiments';
import { differs, percent, type Rate } from './stats';

const HELP = `Fight lab: npm run sim -- <experiment> [options]

Experiments:
  report       the standard report (${REPORT.join(', ')}): run it before and after a change
  sides        two identical CPUs: does player 1 win about half the time?
  ladder       each difficulty against each other one
  styles       each CPU style against each other one (--difficulty)
  mechanics    fight length, damage by source, mechanics used, comebacks (--difficulty)
  forms        each big special form against each other one, all else equal
  matchup      one species against another: --a charizard --b blastoise
  economy      prize money and prices along a journey (no fights simulated)

Options:
  --n 200            duels per matchup (more = narrower intervals; 200 gives about ±7%)
  --seed 1           change it to check a result isn't luck
  --level 50         the Pokémon's level
  --difficulty hard  easy, normal or hard
  --json file        save the metrics (a baseline)
  --baseline file    compare against saved metrics
`;

function args(argv: string[]) {
  const [command = 'help', ...rest] = argv;
  const flags: Record<string, string> = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      flags[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true';
    }
  }
  return { command, flags };
}

function markdown(table: Table): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [`**${table.title}**`, '', line(table.headers), line(table.headers.map(() => '---')), ...table.rows.map(line)].join('\n');
}

const isRate = (v: unknown): v is Rate => typeof v === 'object' && v !== null && 'p' in v;

function compare(now: Report['metrics'], before: Report['metrics']): string {
  const rows: string[][] = [];
  for (const [key, value] of Object.entries(now)) {
    const old = before[key];
    if (old === undefined) continue;
    if (isRate(value) && isRate(old)) {
      rows.push([key, percent(old.p), percent(value.p), `${value.p >= old.p ? '+' : ''}${((value.p - old.p) * 100).toFixed(1)} pts`, differs(value, old) ? '**yes**' : 'no']);
    } else if (typeof value === 'number' && typeof old === 'number') {
      const delta = value - old;
      rows.push([key, old.toFixed(3), value.toFixed(3), `${delta >= 0 ? '+' : ''}${delta.toFixed(3)}`, '']);
    }
  }
  return markdown({ title: 'Against the baseline', headers: ['metric', 'baseline', 'now', 'change', 'real? (95%)'], rows });
}

export function main(argv: string[]): void {
  const { command, flags } = args(argv);
  const options: Options = { n: Number(flags.n ?? 200), seed: Number(flags.seed ?? 1), level: Number(flags.level ?? 50) };
  const difficulty = (flags.difficulty ?? 'hard') as Difficulty;
  const run: Record<string, () => Report> = {
    sides: () => sides(options, difficulty),
    ladder: () => ladder(options),
    styles: () => styles(options, difficulty),
    mechanics: () => mechanics(options, difficulty),
    forms: () => forms({ ...options, n: Number(flags.n ?? 40) }, difficulty),
    matchup: () => matchup(options, flags.a ?? 'charizard', flags.b ?? 'blastoise', difficulty),
    economy: () => economy(),
  };
  const commands = command === 'report' ? [...REPORT] : [command];
  if (commands.some(c => !run[c])) {
    console.log(HELP);
    return;
  }
  const metrics: Report['metrics'] = {};
  const started = Date.now();
  for (const c of commands) {
    const report = run[c]();
    Object.assign(metrics, report.metrics);
    console.log(`\n## ${report.title}\n\n_${report.question}_\n`);
    for (const table of report.tables) console.log(`${markdown(table)}\n`);
  }
  console.log(`_${commands.join(', ')} · n ${options.n} · seed ${options.seed} · Lv. ${options.level} · ${((Date.now() - started) / 1000).toFixed(1)} s_`);
  if (flags.baseline) console.log(`\n${compare(metrics, JSON.parse(readFileSync(flags.baseline, 'utf8')) as Report['metrics'])}`);
  if (flags.json) {
    writeFileSync(flags.json, `${JSON.stringify(metrics, null, 2)}\n`);
    console.log(`\nMetrics saved to ${flags.json}`);
  }
}
