// The CPU: fair (sees late, decides once per threat, only presses buttons), deterministic, and harder is better.

import { describe, expect, it } from 'vitest';
import { PP_MAX } from '../constants';
import { Button, has, type InputMask } from '../input';
import { createFight, type FightEvent, type FightState, type Loadout } from '../state';
import { step } from '../step';
import { fightAt, on } from '../testing';
import { cpuStep, createCpu, resetCpuMemory, type CpuState } from './cpu';
import { DIFFICULTIES, makeProfile, STYLES, type AiProfile, type Difficulty } from './profiles';

/** A CPU that only reacts to threats: no plans of its own (it just waits). */
const reactive = (overrides: Partial<AiProfile>): AiProfile => ({
  ...makeProfile('hard'),
  aggression: 0,
  zoning: 0,
  jump: 0,
  big: 0,
  caution: 0,
  guard: 0,
  antiAir: 0,
  punish: 0,
  ...overrides,
});

interface Duel {
  final: FightState;
  events: (FightEvent & { frame: number })[];
  cpuInputs: InputMask[];
  /** Player 2's PP right before each of its inputs. */
  cpuPp: number[];
}

/** Player 1 follows a script; player 2 is the CPU. */
function vsCpu(frames: number, p1: (frame: number) => InputMask, profile: AiProfile, start: FightState = createFight(), seed = 1): Duel {
  let state = start;
  let cpu: CpuState = createCpu(1, profile, seed);
  const events: Duel['events'] = [];
  const cpuInputs: InputMask[] = [];
  const cpuPp: number[] = [];
  for (let i = 0; i < frames && (state.winner === null || i < frames); i++) {
    const frame = state.frame + 1;
    const decision = cpuStep(cpu, state);
    cpu = decision.cpu;
    cpuInputs.push(decision.input);
    cpuPp.push(state.fighters[1].pp);
    const result = step(state, [p1(frame), decision.input]);
    state = result.state;
    events.push(...result.events.map(e => ({ ...e, frame })));
  }
  return { final: state, events, cpuInputs, cpuPp };
}

/** CPU against CPU until someone wins. */
function cpuDuel(a: AiProfile, b: AiProfile, seed: number) {
  let state = createFight();
  let c0 = createCpu(0, a, seed);
  let c1 = createCpu(1, b, seed * 7 + 3);
  const inputs: [InputMask, InputMask][] = [];
  while (state.winner === null) {
    const r0 = cpuStep(c0, state);
    const r1 = cpuStep(c1, state);
    c0 = r0.cpu;
    c1 = r1.cpu;
    inputs.push([r0.input, r1.input]);
    state = step(state, [r0.input, r1.input]).state;
  }
  return { final: state, inputs };
}

const withLoadout = (state: FightState, loadout: Loadout, who: 0 | 1 = 0) => {
  state.fighters[who].loadout = loadout;
  return state;
};
const BEAM: Loadout = { elemental: { name: 'Beam', type: 'water', shape: 'beam' }, big: { name: 'Big', type: 'water', shape: 'beam' } };
const RUSH: Loadout = { elemental: { name: 'Shot', type: 'normal', shape: 'projectile' }, big: { name: 'Rush', type: 'normal', shape: 'rush' } };
const contacts = (d: Duel) => d.events.filter(e => e.type === 'hit' || e.type === 'block');

describe('the CPU sees the opponent late', () => {
  it('its view is exactly `reaction` frames old', () => {
    let state = createFight();
    let cpu = createCpu(1, reactive({ reaction: 10 }), 1);
    for (let i = 0; i < 30; i++) {
      cpu = cpuStep(cpu, state).cpu;
      state = step(state, [0, 0]).state;
    }
    expect(cpu.seen).toHaveLength(11);
    expect(cpu.seen[cpu.seen.length - 1].frame - cpu.seen[0].frame).toBe(10);
  });

  it('guards a projectile it sees coming', () => {
    const d = vsCpu(80, on(Button.Special, 1), reactive({ guard: 1 }), fightAt(300));
    expect(contacts(d).map(e => e.type)).toEqual(['block']);
  });

  it('with a reaction slower than the projectile, it gets hit', () => {
    const d = vsCpu(80, on(Button.Special, 1), reactive({ guard: 1, reaction: 400 }), fightAt(300));
    expect(contacts(d).map(e => e.type)).toEqual(['hit']);
  });
});

describe('the CPU answers threats', () => {
  it('jumps over a projectile', () => {
    const d = vsCpu(200, on(Button.Special, 1), reactive({ jump: 1 }), fightAt(300));
    expect(contacts(d)).toEqual([]);
    expect(d.final.projectiles).toHaveLength(0);
  });

  it('guards a beam while it is being charged', () => {
    const d = vsCpu(60, on(Button.Special, 1), reactive({ guard: 1 }), withLoadout(fightAt(200), BEAM));
    expect(contacts(d).map(e => e.type)).toEqual(['block']);
  });

  it('anti-airs a jump-in with a tackle', () => {
    const forwardJump = (f: number) => (f <= 3 ? Button.Up | Button.Right : 0);
    const d = vsCpu(60, forwardJump, reactive({ antiAir: 1 }), fightAt(90));
    expect(contacts(d)[0]).toMatchObject({ type: 'hit', attacker: 1, air: true });
  });

  it('guards a rush, then punishes the long recovery', () => {
    const d = vsCpu(150, on(Button.Big, 1), reactive({ guard: 1, punish: 1 }), withLoadout(fightAt(100, { pp: [PP_MAX, 50] }), RUSH));
    expect(contacts(d).map(e => [e.type, e.type === 'hit' || e.type === 'block' ? e.attacker : -1])).toEqual([
      ['block', 0],
      ['hit', 1],
    ]);
  });

  it('hits back right after blocking a tackle (the tackle is -1 on block)', () => {
    // A cautious CPU guards up close; player 1 tackles once.
    const d = vsCpu(80, on(Button.Physical, 30), reactive({ caution: 1, punish: 1, planFrames: [200, 200] }), fightAt(40));
    expect(contacts(d).map(e => [e.type, e.type === 'hit' || e.type === 'block' ? e.attacker : -1])).toEqual([
      ['block', 0],
      ['hit', 1],
    ]);
  });
});

describe('the CPU plays by the rules', () => {
  const long = cpuDuel(makeProfile('hard', 'aggressive'), makeProfile('normal', 'zoner'), 5);

  it('is deterministic: same seed, same fight', () => {
    expect(cpuDuel(makeProfile('normal'), makeProfile('normal'), 3).inputs).toEqual(cpuDuel(makeProfile('normal'), makeProfile('normal'), 3).inputs);
    expect(cpuDuel(makeProfile('normal'), makeProfile('normal'), 3).inputs).not.toEqual(cpuDuel(makeProfile('normal'), makeProfile('normal'), 4).inputs);
  });

  it('releases a button before pressing it again (no turbo)', () => {
    for (const side of [0, 1] as const) {
      const masks = long.inputs.map(pair => pair[side]);
      for (const button of [Button.Physical, Button.Special, Button.Big, Button.Dash]) {
        masks.forEach((mask, i) => {
          if (i > 0 && has(mask, button)) expect(has(masks[i - 1], button)).toBe(false);
        });
      }
    }
  });

  it('only goes for the big special with a full PP bar', () => {
    const d = vsCpu(3000, () => 0, makeProfile('hard', 'aggressive'));
    d.cpuInputs.forEach((input, i) => {
      if (has(input, Button.Big)) expect(d.cpuPp[i]).toBe(PP_MAX);
    });
  });

  it('forgets the last round but keeps its random sequence', () => {
    let cpu = createCpu(1, makeProfile('normal'), 9);
    let state = createFight();
    for (let i = 0; i < 50; i++) {
      cpu = cpuStep(cpu, state).cpu;
      state = step(state, [0, 0]).state;
    }
    const fresh = resetCpuMemory(cpu);
    expect(fresh).toMatchObject({ seen: [], responses: {}, last: 0, rng: cpu.rng });
  });
});

describe('profiles', () => {
  it('harder sees sooner, guards and punishes more', () => {
    const [easy, normal, hard] = DIFFICULTIES.map(d => makeProfile(d));
    expect(easy.reaction).toBeGreaterThan(normal.reaction);
    expect(normal.reaction).toBeGreaterThan(hard.reaction);
    for (const skill of ['guard', 'antiAir', 'punish'] as const) {
      expect(easy[skill]).toBeLessThan(normal[skill]);
      expect(normal[skill]).toBeLessThan(hard[skill]);
    }
  });

  it('styles change personality, not skill', () => {
    const profiles = STYLES.map(s => makeProfile('normal', s));
    expect(new Set(profiles.map(p => p.reaction)).size).toBe(1);
    expect(makeProfile('normal', 'aggressive').aggression).toBeGreaterThan(makeProfile('normal', 'defensive').aggression);
    expect(makeProfile('normal', 'zoner').zoning).toBeGreaterThan(makeProfile('normal', 'aggressive').zoning);
  });
});

// Balance: measured with fixed seeds (so these never flake). The thresholds sit below the measured results;
// if a change drops below them, the CPU or the frame data got worse on purpose or by accident.
describe('balance', () => {
  const wins = (a: Difficulty, b: Difficulty) =>
    Array.from({ length: 20 }, (_, s) => cpuDuel(makeProfile(a), makeProfile(b), s + 1)).filter(d => d.final.winner === 0).length;

  it('hard beats easy (measured 19/20) and normal (17/20); normal beats easy (17/20)', () => {
    expect(wins('hard', 'easy')).toBeGreaterThanOrEqual(16);
    expect(wins('hard', 'normal')).toBeGreaterThanOrEqual(13);
    expect(wins('normal', 'easy')).toBeGreaterThanOrEqual(13);
  });

  it('every difficulty beats a player who does nothing, well before the timer', () => {
    for (const difficulty of DIFFICULTIES) {
      const d = vsCpu(99 * 60, () => 0, makeProfile(difficulty));
      expect(d.final.winner).toBe(1);
      expect(d.final.timeOver).toBe(false);
    }
  });

  it('hard beats a slow tackle spammer (measured 20/20)', () => {
    const spam = (f: number) => Button.Right | (f % 40 === 0 ? Button.Physical : 0);
    const cpuWins = Array.from({ length: 20 }, (_, s) => vsCpu(99 * 60, spam, makeProfile('hard'), createFight(), s + 1)).filter(
      d => d.final.winner === 1,
    ).length;
    expect(cpuWins).toBeGreaterThanOrEqual(17);
  });
});
