import { describe, expect, it } from 'vitest';
import { PP_MAX } from '../fight/constants';
import { DUMMY_ATTACK_EVERY, DUMMY_SPECIAL_EVERY } from '../fight/dummy';
import { Button } from '../fight/input';
import { createSandbox, type Sandbox } from './sandbox';
import { DUMMY_TEAM, PLAYER_TEAM } from './sandbox-teams';

const ticks = (sandbox: Sandbox, frames: number, input = 0) => {
  for (let i = 0; i < frames; i++) sandbox.tick(input);
};

describe('sandbox', () => {
  it('starts a battle of the two placeholder teams, standing dummy, no debug overlay', () => {
    const view = createSandbox().view();
    expect(view).toMatchObject({ debug: false, dummy: 'stand', infinitePp: false });
    expect(view.battle.round.frame).toBe(0);
    expect(view.battle.teams.map(t => t.length)).toEqual([PLAYER_TEAM.length, DUMMY_TEAM.length]);
    expect(view.battle.round.fighters.map(f => f.name)).toEqual([PLAYER_TEAM[0].name, DUMMY_TEAM[0].name]);
  });

  it('every special shape is in the sandbox teams', () => {
    const all = [...PLAYER_TEAM, ...DUMMY_TEAM];
    expect(new Set(all.map(m => m.loadout.elemental.shape))).toEqual(new Set(['projectile', 'beam']));
    expect(new Set(all.map(m => m.loadout.big.shape))).toEqual(new Set(['projectile', 'beam', 'rush']));
  });

  it('F2 cycles the dummy through all its modes', () => {
    const sandbox = createSandbox();
    const modes = [0, 1, 2, 3, 4, 5].map(() => {
      const mode = sandbox.view().dummy;
      sandbox.cycleDummy();
      return mode;
    });
    expect(modes).toEqual(['stand', 'jump', 'attack', 'guard', 'special', 'stand']);
  });

  it('a jumping dummy leaves the floor', () => {
    const sandbox = createSandbox();
    sandbox.cycleDummy();
    ticks(sandbox, 10);
    expect(sandbox.view().battle.round.fighters[1].y).toBeGreaterThan(0);
  });

  it('an attacking dummy attacks on a fixed rhythm', () => {
    const sandbox = createSandbox();
    sandbox.cycleDummy();
    sandbox.cycleDummy();
    ticks(sandbox, DUMMY_ATTACK_EVERY);
    expect(sandbox.view().battle.round.fighters[1]).toMatchObject({ action: 'attack', actionFrame: 1 });
  });

  it('a guarding dummy guards, a special dummy fires its elemental special', () => {
    const sandbox = createSandbox();
    for (let i = 0; i < 3; i++) sandbox.cycleDummy();
    ticks(sandbox, 2);
    expect(sandbox.view().battle.round.fighters[1].action).toBe('guard');
    sandbox.cycleDummy();
    ticks(sandbox, DUMMY_SPECIAL_EVERY);
    expect(sandbox.view().battle.round.fighters[1].action).toBe('elemental');
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
