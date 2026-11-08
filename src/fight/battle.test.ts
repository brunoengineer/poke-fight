// 6 vs 6 battles: one Pokémon each at a time; after a KO the next one comes in.

import { describe, expect, it } from 'vitest';
import { battleStep, createBattle, KO_DELAY, MAX_TEAM, type BattleEvent, type BattleState, type TeamMember } from './battle';
import { ELEMENTAL_COST, MAX_HP, PP_START } from './constants';
import { ELEMENTAL, PHYSICAL } from './frame-data';
import { Button, type InputMask } from './input';
import { DEFAULT_LOADOUT } from './state';

const { Physical, Special, Right, Down, Up } = Button;

const member = (name: string, hp = MAX_HP): TeamMember => ({ name, type: 'normal', maxHp: MAX_HP, hp, loadout: DEFAULT_LOADOUT });
const team = (prefix: string, count: number, hp = MAX_HP) => Array.from({ length: count }, (_, i) => member(`${prefix}${i + 1}`, hp));

type Script = (frame: number) => InputMask;

function play(battle: BattleState, frames: number, p1: Script = () => 0, p2: Script = () => 0) {
  const events: (BattleEvent & { at: number })[] = [];
  for (let i = 1; i <= frames; i++) {
    const result = battleStep(battle, [p1(i), p2(i)]);
    battle = result.battle;
    events.push(...result.events.map(e => ({ ...e, at: i })));
  }
  return { battle, events };
}

/** Walks into the opponent and tackles every 30 frames: one-hit KOs for opponents with ≤ 80 HP. */
const brawl: Script = f => Right | (f % 30 === 0 ? Physical : 0);

describe('battle', () => {
  it('needs 1 to 6 Pokémon per team, with at least one able to fight', () => {
    expect(() => createBattle([[], team('B', 1)])).toThrow();
    expect(() => createBattle([team('A', MAX_TEAM + 1), team('B', 1)])).toThrow();
    expect(() => createBattle([team('A', 2, 0), team('B', 1)])).toThrow();
    expect(createBattle([team('A', MAX_TEAM), team('B', MAX_TEAM)]).phase).toBe('fight');
  });

  it('starts with the first Pokémon able to fight on each side', () => {
    const battle = createBattle([[member('A1', 0), member('A2')], team('B', 2)]);
    expect(battle.active).toEqual([1, 0]);
    expect(battle.round.fighters.map(f => f.name)).toEqual(['A2', 'B1']);
  });

  it('after a KO, the bodies fall for a moment, then the opponent sends its next Pokémon', () => {
    const battle = createBattle([team('A', 2), team('B', 3, PHYSICAL.hit.damage)]);
    const { battle: after, events } = play(battle, 200, brawl);
    const ko = events.find(e => e.type === 'ko')!;
    const roundStart = events.find(e => e.type === 'roundStart')!;
    expect(roundStart.at - ko.at).toBe(KO_DELAY);
    expect(after.round.fighters[1].name).toBe('B2');
    expect(after.teams[1][0].hp).toBe(0);
  });

  it('the Pokémon that stays keeps its HP and PP; the one coming in has half a PP bar', () => {
    const battle = createBattle([team('A', 1), team('B', 2, PHYSICAL.hit.damage)]);
    const { battle: after } = play(battle, 200, brawl);
    const [p1, p2] = after.round.fighters;
    expect(p1.pp).toBe(PP_START + PHYSICAL.hit.ppGain);
    expect(p2).toMatchObject({ name: 'B2', pp: PP_START });
  });

  it('positions reset for each new round', () => {
    let battle = createBattle([team('A', 1), team('B', 2, PHYSICAL.hit.damage)]);
    const start = battle.round.fighters.map(f => f.x);
    for (let frame = 1; frame <= 200; frame++) {
      const result = battleStep(battle, [brawl(frame), 0]);
      battle = result.battle;
      if (result.events.some(e => e.type === 'roundStart')) break;
    }
    expect(battle.rounds).toBe(2);
    expect(battle.round.fighters.map(f => f.x)).toEqual(start);
  });

  it('when player 1 loses a Pokémon, it chooses the next one (fainted ones are skipped)', () => {
    // Player 1's first Pokémon has 25 HP: the opponent's projectile knocks it out.
    const battle = createBattle([[member('A1', 25), member('A2', 0), member('A3'), member('A4')], team('B', 1)]);
    let { battle: b } = play(battle, 200, () => 0, f => (f === 1 ? Special : 0));
    expect(b.phase).toBe('choose');
    expect(b.cursor).toBe(2); // A3: A1 fainted now, A2 was already fainted
    // Down moves to A4, then down again wraps to A3, up goes back to A4. J confirms.
    const presses = [Down, 0, Down, 0, Up, 0, Physical];
    ({ battle: b } = play(b, presses.length, f => presses[f - 1]));
    expect(b.phase).toBe('fight');
    expect(b.active[0]).toBe(3);
    expect(b.round.fighters[0]).toMatchObject({ name: 'A4', pp: PP_START });
    // The opponent kept its PP: it spent one special and earned a little when it landed.
    expect(b.round.fighters[1].pp).toBe(PP_START - ELEMENTAL_COST + ELEMENTAL.projectile.hit.ppGain);
  });

  it('a 6 vs 6 battle ends when a team has no Pokémon left', () => {
    const battle = createBattle([team('A', 6), team('B', 6, PHYSICAL.hit.damage)]);
    const { battle: after, events } = play(battle, 6 * 250, brawl);
    expect(after).toMatchObject({ phase: 'over', winner: 0, rounds: 6 });
    expect(events.filter(e => e.type === 'ko')).toHaveLength(6);
    expect(events.filter(e => e.type === 'battleOver')).toHaveLength(1);
    expect(after.teams[1].every(m => m.hp === 0)).toBe(true);
  });

  it('a double KO of the last Pokémon is a draw', () => {
    const battle = createBattle([team('A', 1, PHYSICAL.hit.damage), team('B', 1, PHYSICAL.hit.damage)]);
    // Both start 160 px apart: walk in and tackle on the same frame.
    const both: Script = f => (f < 40 ? Right : f === 40 ? Physical : 0);
    const bothP2: Script = f => (f < 40 ? Button.Left : f === 40 ? Physical : 0);
    const { battle: after } = play(battle, 200, both, bothP2);
    expect(after).toMatchObject({ phase: 'over', winner: 'draw' });
  });

  it('nothing happens once the battle is over', () => {
    const battle = createBattle([team('A', 1), team('B', 1, PHYSICAL.hit.damage)]);
    const { battle: over } = play(battle, 200, brawl);
    expect(over.phase).toBe('over');
    const later = play(over, 60, brawl).battle;
    expect(later).toMatchObject({ phase: 'over', winner: 0, rounds: over.rounds });
    expect(later.round).toEqual(over.round);
    expect(later.teams).toEqual(over.teams);
  });

  it('HP is written back to the team after each round', () => {
    const battle = createBattle([team('A', 1), team('B', 2, PHYSICAL.hit.damage)]);
    const { battle: after } = play(battle, 200, brawl);
    expect(after.teams[0][0].hp).toBe(after.round.fighters[0].hp);
  });
});
