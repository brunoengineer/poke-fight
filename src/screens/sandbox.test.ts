import { describe, expect, it } from 'vitest';
import { PP_MAX } from '../fight/constants';
import { DUMMY_ATTACK_EVERY, DUMMY_SPECIAL_EVERY } from '../fight/dummy';
import { Button } from '../fight/input';
import { createSandbox, isOpponent, OPPONENTS, type Sandbox } from './sandbox';
import { OPPONENT_TEAM, PLAYER_TEAM } from './sandbox-teams';

const ticks = (sandbox: Sandbox, frames: number, input = 0) => {
  for (let i = 0; i < frames; i++) sandbox.tick(input);
};

describe('sandbox', () => {
  it('starts a battle of the two placeholder teams, no debug overlay', () => {
    const view = createSandbox().view();
    expect(view).toMatchObject({ debug: false, opponent: 'stand', infinitePp: false, cpu: null });
    expect(view.battle.round.frame).toBe(0);
    expect(view.battle.teams.map(t => t.length)).toEqual([PLAYER_TEAM.length, OPPONENT_TEAM.length]);
    expect(view.battle.round.fighters.map(f => f.name)).toEqual([PLAYER_TEAM[0].name, OPPONENT_TEAM[0].name]);
  });

  it('every special shape is in the sandbox teams', () => {
    const all = [...PLAYER_TEAM, ...OPPONENT_TEAM];
    expect(new Set(all.map(m => m.loadout.elemental.shape))).toEqual(new Set(['projectile', 'beam']));
    expect(new Set(all.map(m => m.loadout.big.shape))).toEqual(new Set(['projectile', 'beam', 'rush']));
  });

  it('F2 cycles player 2 through the dummy behaviors and the CPU levels', () => {
    const sandbox = createSandbox();
    const seen = OPPONENTS.map(() => {
      const opponent = sandbox.view().opponent;
      sandbox.cycleOpponent();
      return opponent;
    });
    expect(seen).toEqual(['stand', 'jump', 'attack', 'guard', 'special', 'cpu-easy', 'cpu-normal', 'cpu-hard']);
    expect(sandbox.view().opponent).toBe('stand');
  });

  it('recognizes opponent names (for the URL setting)', () => {
    expect(isOpponent('cpu-hard')).toBe(true);
    expect(isOpponent('guard')).toBe(true);
    expect(isOpponent('cpu-impossible')).toBe(false);
  });

  it('a jumping dummy leaves the floor', () => {
    const sandbox = createSandbox({ opponent: 'jump' });
    ticks(sandbox, 10);
    expect(sandbox.view().battle.round.fighters[1].y).toBeGreaterThan(0);
  });

  it('an attacking dummy attacks on a fixed rhythm', () => {
    const sandbox = createSandbox({ opponent: 'attack' });
    ticks(sandbox, DUMMY_ATTACK_EVERY);
    expect(sandbox.view().battle.round.fighters[1]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });

  it('a guarding dummy guards, a special dummy fires its elemental special', () => {
    const guard = createSandbox({ opponent: 'guard' });
    ticks(guard, 2);
    expect(guard.view().battle.round.fighters[1].action).toBe('guard');
    const special = createSandbox({ opponent: 'special' });
    ticks(special, DUMMY_SPECIAL_EVERY);
    expect(special.view().battle.round.fighters[1].action).toBe('elemental');
  });

  it('a CPU opponent plays on its own and wins against a player who does nothing', () => {
    const sandbox = createSandbox({ opponent: 'cpu-hard' });
    expect(sandbox.view().cpu).toMatch(/^hard balanced/);
    for (let i = 0; i < 60 * 60 && sandbox.view().battle.phase === 'fight'; i++) sandbox.tick(0);
    expect(sandbox.view().battle.teams[0][0].hp).toBe(0);
  });

  it('F4 changes the CPU style', () => {
    const sandbox = createSandbox({ opponent: 'cpu-normal' });
    sandbox.cycleStyle();
    expect(sandbox.view()).toMatchObject({ style: 'aggressive' });
    expect(sandbox.view().cpu).toMatch(/^normal aggressive/);
  });

  it('the same seed gives the same CPU fight', () => {
    const play = (seed: number) => {
      const sandbox = createSandbox({ opponent: 'cpu-normal', seed });
      ticks(sandbox, 600, Button.Right);
      return sandbox.view().battle.round;
    };
    expect(play(5)).toEqual(play(5));
  });

  it('F3 keeps both PP bars full (training)', () => {
    const sandbox = createSandbox();
    sandbox.toggleInfinitePp();
    sandbox.tick(Button.Special);
    expect(sandbox.view().battle.round.fighters.map(f => f.pp)).toEqual([PP_MAX, PP_MAX]);
  });

  it('records player 1 input history and resets the battle', () => {
    const sandbox = createSandbox();
    ticks(sandbox, 5, Button.Right);
    expect(sandbox.view().history[0]).toEqual({ mask: Button.Right, frames: 5 });
    sandbox.reset();
    expect(sandbox.view().battle.round.frame).toBe(0);
    expect(sandbox.view().battle.round.fighters[0].x).toBe(createSandbox().view().battle.round.fighters[0].x);
  });
});
