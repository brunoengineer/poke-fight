import { describe, expect, it } from 'vitest';
import { PP_MAX } from '../fight/constants';
import { BOSS_HP_MULTIPLIER, BOSS_SCHEDULE } from '../fight/boss';
import { DUMMY_ATTACK_EVERY, DUMMY_SPECIAL_EVERY } from '../fight/dummy';
import { KO_DELAY } from '../fight/battle';
import { Button } from '../fight/input';
import { ENTRANCE } from './entrance';
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

  it('the sandbox teams show both elemental shapes and five big forms', () => {
    const all = [...PLAYER_TEAM, ...OPPONENT_TEAM];
    expect(new Set(all.map(m => m.loadout.elemental.shape))).toEqual(new Set(['projectile', 'beam']));
    expect(new Set(all.map(m => m.loadout.big.shape))).toEqual(new Set(['tornado', 'burst', 'rush', 'barrage', 'strike']));
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

describe('the trainers’ entrance', () => {
  it('is off unless asked for (the fight starts on frame 0)', () => {
    expect(createSandbox().view().entrance).toBeNull();
  });

  it('the fight waits while the Poké Balls fly, ignoring inputs, then starts', () => {
    const sandbox = createSandbox({ entrance: true });
    expect(sandbox.view().entrance).toEqual({ frame: 0, sides: [true, true], first: true });
    expect(sandbox.view().banner).toBeNull();
    const x = sandbox.view().battle.round.fighters[0].x;
    ticks(sandbox, ENTRANCE.total - 1, Button.Right);
    expect(sandbox.view().entrance?.frame).toBe(ENTRANCE.total - 1);
    expect(sandbox.view().battle.round.frame).toBe(0);
    expect(sandbox.view().battle.round.fighters[0].x).toBe(x);
    sandbox.tick(Button.Right);
    expect(sandbox.view().entrance).toBeNull();
    sandbox.tick(Button.Right);
    expect(sandbox.view().battle.round.frame).toBe(1);
  });

  it('after a K.O., only the side sending a new Pokémon throws a ball (no "FIGHT!")', () => {
    const sandbox = createSandbox({ entrance: true, opponentTeam: [{ ...OPPONENT_TEAM[0], hp: 1 }, OPPONENT_TEAM[1]] });
    ticks(sandbox, ENTRANCE.total);
    for (let i = 0; i < 600 && sandbox.view().battle.phase === 'fight'; i++) sandbox.tick(i % 20 === 0 ? Button.Physical : Button.Right);
    expect(sandbox.view().battle.phase).toBe('ko');
    // The player keeps its Pokémon for the next round (J on the choose screen).
    for (let i = 0; i < KO_DELAY + 5 && !sandbox.view().entrance; i++) sandbox.tick(i % 2 === 0 ? 0 : Button.Physical);
    expect(sandbox.view().entrance).toMatchObject({ sides: [false, true], first: false });
  });

  it('a switch mid-round: the player’s side throws a new ball; refused during the entrance', () => {
    const sandbox = createSandbox({ entrance: true });
    expect(sandbox.trySwitch()).toBe('busy');
    ticks(sandbox, ENTRANCE.total + 5);
    expect(sandbox.trySwitch()).toBe('ok');
    sandbox.tick(Button.Down);
    sandbox.tick(0);
    sandbox.tick(Button.Physical);
    expect(sandbox.view().entrance).toMatchObject({ sides: [true, false], first: false });
    ticks(sandbox, ENTRANCE.total + 5);
    expect(sandbox.trySwitch()).toBe('used');
  });

  it('training against a legendary: the opponents become bosses with 4× HP, and attack on their own', () => {
    const sandbox = createSandbox({ boss: ['nova'] });
    const [, boss] = sandbox.view().battle.round.fighters;
    expect(boss.maxHp).toBe(OPPONENT_TEAM[0].maxHp * BOSS_HP_MULTIPLIER);
    expect(boss.boss).toMatchObject({ attacks: ['nova'] });
    const events = Array.from({ length: BOSS_SCHEDULE.first[1] + 2 }, () => sandbox.tick(0)).flat();
    expect(events).toContainEqual({ type: 'bossAttack', fighter: 1, attack: 'nova', phase: 'telegraph' });
    // Without the option, nobody is a boss.
    expect(createSandbox().view().battle.round.fighters.some(f => f.boss)).toBe(false);
  });

  it('reset (R) plays the whole entrance again', () => {
    const sandbox = createSandbox({ entrance: true });
    ticks(sandbox, ENTRANCE.total + 10);
    sandbox.reset();
    expect(sandbox.view().entrance).toEqual({ frame: 0, sides: [true, true], first: true });
  });
});
