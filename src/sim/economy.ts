// The economy along a journey (docs/fight-lab.md, `npm run sim -- economy`): at each stage (each gym, the League,
// the sanctuary after it), what the battle field pays and how many of its battles the main things to buy cost. The
// targets the prices are set against are in plan.md (§5, Economy).

import { ITEMS, type ItemId } from '../data/items';
import { REGIONS, type Region } from '../data/regions';
import { prizeMoney } from '../game/economy';
import { leaderPrize } from '../game/gym';
import { TRAINING_TEAM } from '../game/story';
import type { Report } from './experiments';

/** About how long a battle-field battle takes (three Pokémon, about 25 s each, and the menus): to read battles as time. */
export const MINUTES_PER_BATTLE = 2;

/** The things worth saving for, in the order a journey meets them. */
const GOALS: [string, ItemId][] = [
  ['Great Ball', 'great-ball'],
  ['Ultra Ball', 'ultra-ball'],
  ['Hyper Potion', 'hyper-potion'],
  ['Evolution stone', 'fire-stone'],
  ['Super Rod', 'super-rod'],
  ['Master Ball', 'master-ball'],
];

interface Stage {
  name: string;
  /** The party's level about then (the leader's best Pokémon: a party arriving can beat it). */
  level: number;
  /** A one-time prize there (the leader's, the Champion's). */
  once: number | null;
}

function stages(region: Region): Stage[] {
  const gyms = [...region.gyms].sort((a, b) => a.badges - b.badges);
  const leagueLevel = Math.max(...region.league.eliteFour.flatMap(m => m.team.map(([, level]) => level)));
  const legendLevel = Math.min(...region.sanctuary.legendaries.map(l => l.level));
  return [
    ...gyms.map(g => ({ name: `${g.leader} (badge ${g.badges + 1})`, level: Math.max(...g.team.map(([, level]) => level)), once: leaderPrize(g) })),
    { name: 'Elite Four', level: leagueLevel, once: 99 * leagueLevel },
    { name: 'Sanctuary (after the League)', level: legendLevel, once: null },
  ];
}

const battles = (price: number, prize: number) => price / prize;

export function economy(regionId = 'kanto'): Report {
  const region = REGIONS.find(r => r.id === regionId) ?? REGIONS[0];
  const metrics: Report['metrics'] = {};
  const rows = stages(region).map((s, i) => {
    const prize = prizeMoney(Array.from({ length: TRAINING_TEAM }, () => s.level));
    const costs = GOALS.map(([, id]) => battles(ITEMS[id].price, prize));
    GOALS.forEach(([, id], k) => (metrics[`economy.${region.id}.${i}.${id}`] = costs[k]));
    return [s.name, String(s.level), prize.toLocaleString('en'), s.once === null ? '—' : s.once.toLocaleString('en'), ...costs.map(c => c.toFixed(1))];
  });
  const prices = GOALS.map(([name, id]) => [name, ITEMS[id].price.toLocaleString('en')]);
  return {
    title: `Economy: ${region.id}`,
    question: `What does a battle-field battle pay at each stage, and how many of them does each thing cost? (One battle ≈ ${MINUTES_PER_BATTLE} min.)`,
    tables: [
      { title: 'Prices', headers: ['item', 'price'], rows: prices },
      {
        title: 'Battles to buy one, by stage',
        headers: ['stage', 'party Lv.', 'battle prize', 'one-time prize', ...GOALS.map(([name]) => name)],
        rows,
      },
    ],
    metrics,
  };
}
