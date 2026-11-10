// Versus selection (plan.md §4.10): the roster follows the journey; each player's cursor, picks and ready state.

import { describe, expect, it } from 'vitest';
import { freshSide, generationStarts, versusAct, versusRoster, versusTeam, VERSUS_COLUMNS, type VersusSide } from './versus';

const kanto = versusRoster([]);

describe('the roster', () => {
  it('is the species of the regions opened in the journey', () => {
    expect(kanto).toHaveLength(151);
    expect(versusRoster(['kanto'])).toHaveLength(251);
    expect(versusRoster(['kanto', 'johto', 'hoenn'])).toHaveLength(493);
    expect(generationStarts(versusRoster(['kanto', 'johto', 'hoenn']))).toEqual([0, 151, 251, 386]);
  });
});

describe('a player’s selection', () => {
  const act = (side: VersusSide, ...actions: Parameters<typeof versusAct>[1][]) =>
    actions.reduce<VersusSide>((s, a) => versusAct(s, a, kanto) as VersusSide, side);

  it('moves in a grid and stops at its edges', () => {
    expect(act(freshSide(), 'left', 'up').cursor).toBe(0);
    expect(act(freshSide(), 'right', 'down').cursor).toBe(VERSUS_COLUMNS + 1);
    // The last row is short (151 = 15 rows of 10 + 1): down from column 5 of row 14 lands on the last one.
    expect(versusAct({ ...freshSide(), cursor: 145 }, 'down', kanto)).toMatchObject({ cursor: 150 });
  });

  it('picks three different species, then confirms: ready', () => {
    let side = act(freshSide(), 'confirm', 'confirm', 'right', 'confirm', 'right', 'confirm');
    expect(side.picks).toEqual([1, 2, 3]);
    expect(side.ready).toBe(false);
    side = act(side, 'confirm');
    expect(side.ready).toBe(true);
    // Ready: nothing moves until back.
    expect(act(side, 'right').cursor).toBe(side.cursor);
  });

  it('back: not ready, then the last pick, then leave', () => {
    let side: VersusSide = { cursor: 0, picks: [1, 4], ready: false };
    side = act(side, 'back');
    expect(side.picks).toEqual([1]);
    expect(versusAct({ cursor: 0, picks: [], ready: false }, 'back', kanto)).toBe('leave');
    expect(versusAct({ cursor: 0, picks: [1, 2, 3], ready: true }, 'back', kanto)).toMatchObject({ ready: false, picks: [1, 2, 3] });
  });

  it('jumps between generations', () => {
    const all = versusRoster(['kanto', 'johto', 'hoenn']);
    const next = versusAct(freshSide(), 'nextGen', all) as VersusSide;
    expect(next.cursor).toBe(151);
    expect((versusAct({ ...freshSide(), cursor: 160 }, 'prevGen', all) as VersusSide).cursor).toBe(151);
    expect((versusAct({ ...freshSide(), cursor: 151 }, 'prevGen', all) as VersusSide).cursor).toBe(0);
  });
});

describe('a team', () => {
  it('is Lv. 100', () => {
    expect(versusTeam([25, 6, 9]).map(m => m.level)).toEqual([100, 100, 100]);
  });
});
