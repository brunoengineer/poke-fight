// The CPU: fair (sees late, decides once per threat, only presses buttons), deterministic, and harder is better.

import { describe, expect, it } from 'vitest';
import { PP_MAX } from '../constants';
import { Button, has, type InputMask } from '../input';
import { createFight, type FightEvent, type FightState, type Loadout } from '../state';
import { step } from '../step';
import { fightAt, on } from '../testing';
import { cpuStep, createCpu, resetCpuMemory, type CpuState } from './cpu';
import { boosted, DIFFICULTIES, makeProfile, STYLES, type AiProfile, type Difficulty } from './profiles';

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
const BEAM: Loadout = {
  elemental: { name: 'Beam', type: 'water', power: 40, category: 'special', shape: 'beam' },
  big: { name: 'Big', type: 'water', power: 110, category: 'special', shape: 'beam' },
};
const RUSH: Loadout = {
  elemental: { name: 'Shot', type: 'normal', power: 40, category: 'special', shape: 'projectile' },
  big: { name: 'Rush', type: 'normal', power: 110, category: 'physical', shape: 'rush' },
};
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

  it('guards a beam while it is being charged (pressed late, it can even be a parry)', () => {
    const d = vsCpu(60, on(Button.Special, 1), reactive({ guard: 1 }), withLoadout(fightAt(200), BEAM));
    expect(d.events.some(e => e.type === 'hit' && e.defender === 1)).toBe(false);
    expect(d.events.filter(e => e.type === 'block' || e.type === 'parry')).toHaveLength(1);
  });

  it('anti-airs a jump-in with a tackle', () => {
    const forwardJump = (f: number) => (f <= 3 ? Button.Up | Button.Right : 0);
    const d = vsCpu(60, forwardJump, reactive({ antiAir: 1 }), fightAt(90));
    expect(contacts(d)[0]).toMatchObject({ type: 'hit', attacker: 1, air: true });
  });

  it('never tries to jump a tornado (taller than any jump): it guards it, or takes it', () => {
    const tornado: Loadout = { ...RUSH, big: { name: 'Fire Spin', type: 'fire', power: 110, category: 'special', shape: 'tornado' } };
    const start = () => withLoadout(fightAt(200, { pp: [PP_MAX, 50] }), tornado);
    // A CPU that always jumps projectiles and never guards (its first plan, waiting, lasts the whole test, so it only
    // reacts): it stays on the ground.
    const jumper = vsCpu(200, on(Button.Big, 1), reactive({ guard: 0, jump: 1, planFrames: [400, 400] }), start());
    expect(jumper.cpuInputs.some(input => has(input, Button.Up))).toBe(false);
    // One that guards: it blocks it (or parries it).
    const guard = vsCpu(200, on(Button.Big, 1), reactive({ guard: 1, jump: 1 }), start());
    expect(guard.events.some(e => e.type === 'hit' && e.defender === 1)).toBe(false);
    expect(guard.events.filter(e => e.type === 'block' || e.type === 'parry')).toHaveLength(1);
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
// Each test plays 20 to 60 whole fights: ~1.5 s here, but CI's runners are 3–4× slower (the spammer test took 5.2 s
// there and hit Vitest's 5 s default), so this block gets more time.
describe('balance', { timeout: 30_000 }, () => {
  const wins = (a: Difficulty, b: Difficulty) =>
    Array.from({ length: 20 }, (_, s) => cpuDuel(makeProfile(a), makeProfile(b), s + 1)).filter(d => d.final.winner === 0).length;

  // 20 fights is a smoke test; the real numbers come from the fight lab (npm run sim -- ladder: hard beats normal
  // 62%, easy 91%; normal beats easy 75%, 400 duels each, docs/fight-lab.md). Normal got closer to hard after
  // milestone 13 (it guards more, and a CPU far behind plays a step up).
  it('hard beats easy (measured 20/20) and normal (12/20); normal beats easy (20/20)', () => {
    expect(wins('hard', 'easy')).toBeGreaterThanOrEqual(17);
    expect(wins('hard', 'normal')).toBeGreaterThanOrEqual(11);
    expect(wins('normal', 'easy')).toBeGreaterThanOrEqual(17);
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

describe('after milestone 13', () => {
  it("plays a step up while its opponent is more than half a bar ahead, and back once the gap is under a quarter", () => {
    const behind = createFight({ hp: [1000, 400] });
    const first = cpuStep(createCpu(1, makeProfile('normal'), 1), behind);
    expect(first.cpu.boosted).toBe(true);
    // Still behind by 0.3: it stays boosted (no flicker around the threshold).
    expect(cpuStep(first.cpu, createFight({ hp: [1000, 700] })).cpu.boosted).toBe(true);
    expect(cpuStep(first.cpu, createFight({ hp: [1000, 800] })).cpu.boosted).toBe(false);
    // Ahead or close, never boosted (it never plays worse than its level either).
    expect(cpuStep(createCpu(1, makeProfile('normal'), 1), createFight({ hp: [400, 1000] })).cpu.boosted).toBe(false);
  });

  it('a boosted CPU is faster and guards more, within limits', () => {
    const normal = makeProfile('normal');
    const up = boosted(normal);
    expect(up.reaction).toBeLessThan(normal.reaction);
    expect(up.guard).toBeGreaterThan(normal.guard);
    expect(boosted(makeProfile('hard')).guard).toBeLessThanOrEqual(0.95);
  });

  it('cashes in a bonus up close: with a back attack ready it tackles at once', () => {
    const state = fightAt(40);
    state.fighters[1].bonus = { kind: 'back', frames: 20 };
    const d = vsCpu(12, () => 0, reactive({}), state);
    expect(d.events.find(e => e.type === 'hit')).toMatchObject({ attacker: 1, bonus: 'back' });
  });

  it('guards a projectile special from mid range on its charge (in flight it would arrive faster than a reaction)', () => {
    const d = vsCpu(80, on(Button.Special, 1), reactive({ guard: 1, parry: 0, reaction: 18 }), fightAt(110));
    expect(d.events.some(e => e.type === 'hit' && e.defender === 1)).toBe(false);
    expect(d.events.some(e => e.type === 'block')).toBe(true);
  });
});

describe('moves of their own (plan.md §4.9)', () => {
  const SIG: Loadout = { ...RUSH, signature: { name: 'Thunder', type: 'electric', power: 90, category: 'special', shape: 'strike' } };
  const LEG: Loadout = { ...RUSH, legend: { attack: 'nova', type: 'psychic', category: 'special', shape: 'burst' } };
  const used = (d: Duel, kind: 'signature' | 'legend') => d.events.some(e => e.type === 'special' && e.fighter === 1 && e.kind === kind);

  it('a CPU with a signature move types its motion and uses it (free)', () => {
    const state = withLoadout(fightAt(200), SIG, 1);
    const d = vsCpu(600, () => 0, { ...makeProfile('normal', 'zoner'), big: 0 }, state);
    expect(used(d, 'signature')).toBe(true);
  });

  it('a CPU with a legendary move uses it once its bar is full enough, close enough for its form', () => {
    const state = withLoadout(fightAt(70, { pp: [50, PP_MAX] }), LEG, 1);
    const d = vsCpu(400, () => 0, { ...makeProfile('hard'), big: 1 }, state);
    expect(used(d, 'legend')).toBe(true);
  });

  it('a legendary boss keeps to its own attacks (it never types down, down)', () => {
    // The CPU alone, frame after frame (a boss's attacks are fight/boss.ts's business): it only checks it is one.
    const state = withLoadout(fightAt(70, { pp: [50, PP_MAX] }), LEG, 1);
    state.fighters[1].boss = {} as NonNullable<FightState['fighters'][1]['boss']>;
    let cpu = createCpu(1, { ...makeProfile('hard'), big: 1 }, 1);
    const inputs: InputMask[] = [];
    for (let frame = 1; frame <= 300; frame++) {
      state.frame = frame;
      const r = cpuStep(cpu, state);
      cpu = r.cpu;
      inputs.push(r.input);
    }
    expect(inputs.some(input => has(input, Button.Down))).toBe(false);
    // Without the boss mark, the same CPU does.
    delete state.fighters[1].boss;
    cpu = createCpu(1, { ...makeProfile('hard'), big: 1 }, 1);
    const plain: InputMask[] = [];
    for (let frame = 1; frame <= 300; frame++) {
      state.frame = frame;
      const r = cpuStep(cpu, state);
      cpu = r.cpu;
      plain.push(r.input);
    }
    expect(plain.some(input => has(input, Button.Down))).toBe(true);
  });
});
