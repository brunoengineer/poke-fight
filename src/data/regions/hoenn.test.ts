// Hoenn's own checks, on top of the ones every region gets (regions.test.ts): the journey's pace (rods, the big
// store, leaders getting stronger) and the sanctuary's bosses.

import { describe, expect, it } from 'vitest';
import { isBossAttack } from '../../fight/boss';
import { EVOLUTION_ITEMS, type ItemId } from '../items';
import { region } from './index';

const hoenn = region('hoenn');
const firstSelling = (item: ItemId) => hoenn.cities.findIndex(c => c.shop?.includes(item));

describe('Hoenn', () => {
  it('rods come in order along the journey: the Old Rod in Dewford, the Good Rod in Mauville, the Super Rod in Lilycove', () => {
    expect(hoenn.cities[firstSelling('old-rod')].id).toBe('dewford');
    expect(hoenn.cities[firstSelling('good-rod')].id).toBe('mauville');
    expect(hoenn.cities[firstSelling('super-rod')].id).toBe('lilycove');
  });

  it('Lilycove’s Department Store sells every evolution item that works in Hoenn (not the Gen 4 stones)', () => {
    const store = hoenn.cities.find(c => c.id === 'lilycove')!.shop!;
    const gen4: ItemId[] = ['dusk-stone', 'shiny-stone', 'dawn-stone'];
    for (const item of EVOLUTION_ITEMS) expect(store.includes(item), item).toBe(!gen4.includes(item));
  });

  it('cities open in story order, and each leader’s strongest Pokémon is stronger than the last one’s', () => {
    const badges = hoenn.cities.map(c => c.badges);
    expect(badges).toEqual([...badges].sort((a, b) => a - b));
    const tops = hoenn.gyms.map(g => Math.max(...g.team.map(([, level]) => level)));
    for (let i = 1; i < tops.length; i++) expect(tops[i], hoenn.gyms[i].leader).toBeGreaterThan(tops[i - 1]);
  });

  it('the Champion is Wallace (Emerald), stronger than every Elite Four member', () => {
    const champion = hoenn.league.champion;
    expect(champion.kind === 'member' && champion.id).toBe('wallace');
    const top = (team: readonly (readonly [string, number])[]) => Math.max(...team.map(([, level]) => level));
    if (champion.kind !== 'member') return;
    for (const m of hoenn.league.eliteFour) expect(top(champion.team)).toBeGreaterThan(top(m.team));
  });

  it('the sanctuary: every legendary’s attacks are real boss attacks, and one road leads there', () => {
    for (const l of hoenn.sanctuary.legendaries) for (const a of l.attacks) expect(isBossAttack(a), `${l.species}: ${a}`).toBe(true);
    const roads = hoenn.map.routes.filter(r => r.includes(hoenn.sanctuary.id));
    expect(roads).toHaveLength(1);
  });
});
