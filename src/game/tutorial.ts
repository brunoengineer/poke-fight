// The rival tutorial (plan.md §3): one instruction at a time, each checked from what really happens in the fight.
// During the guided steps the rival only does what the step needs, nobody can be knocked out and the clock stops.
// Then the rival (an easy CPU) fights for real: "Now win the battle!". Win or lose, the story goes on.

import { cpuStep, createCpu, type CpuState } from '../fight/ai/cpu';
import { makeProfile } from '../fight/ai/profiles';
import { ELEMENTAL_COST, ROUND_FRAMES, SUB } from '../fight/constants';
import { Button, type InputMask } from '../fight/input';
import type { FightEvent, FightState } from '../fight/state';

export const TUTORIAL_STEPS = ['move', 'jump', 'tackle', 'air', 'guard', 'dash', 'special', 'finish'] as const;
export type TutorialStep = (typeof TUTORIAL_STEPS)[number];
/** The guided steps (all but the free fight at the end). */
export const GUIDED_STEPS = TUTORIAL_STEPS.length - 1;

export interface TutorialState {
  step: number;
  /** Frames spent walking forward (the first step needs half a second of it). */
  walked: number;
  /** The rival, from the last step on. */
  cpu: CpuState;
  /** The rival's input on the last frame (to press its attack again it must let go first). */
  last: InputMask;
}

export const WALK_FRAMES = 30;
/** In the guard step, the rival walks up to this distance (px) and attacks. */
export const RIVAL_REACH = 44;

export const createTutorial = (seed: number): TutorialState => ({
  step: 0,
  walked: 0,
  cpu: createCpu(1, makeProfile('easy'), seed),
  last: 0,
});

export const currentStep = (t: TutorialState): TutorialStep => TUTORIAL_STEPS[t.step];
export const isGuided = (t: TutorialState) => currentStep(t) !== 'finish';

/** The rival's input for the next frame. */
export function rivalInput(t: TutorialState, round: FightState): { tutorial: TutorialState; input: InputMask } {
  const step = currentStep(t);
  if (step === 'finish') {
    const decision = cpuStep(t.cpu, round);
    return { tutorial: { ...t, cpu: decision.cpu, last: decision.input }, input: decision.input };
  }
  let input = 0;
  if (step === 'guard') {
    // Walk up to the player, then tackle again and again.
    const [player, rival] = round.fighters;
    const forward = rival.facing === 1 ? Button.Right : Button.Left;
    const distance = Math.abs(player.x - rival.x) / SUB;
    if (distance > RIVAL_REACH) input = forward;
    else if (rival.actionable && !(t.last & Button.Physical)) input = Button.Physical;
  }
  return { tutorial: { ...t, last: input }, input };
}

/** Has the current step been done on this frame? */
function stepDone(t: TutorialState, round: FightState, events: readonly FightEvent[]): boolean {
  const player = round.fighters[0];
  const landed = (source: string) => events.some(e => e.type === 'hit' && e.attacker === 0 && e.source === source);
  switch (currentStep(t)) {
    case 'move':
      return t.walked >= WALK_FRAMES;
    case 'jump':
      return player.action === 'jump';
    case 'tackle':
      return landed('tackle');
    case 'air':
      return landed('air');
    case 'guard':
      return events.some(e => e.type === 'block' && e.defender === 0);
    case 'dash':
      return player.action === 'dash';
    case 'special':
      return landed('elemental');
    case 'finish':
      return false;
  }
}

/**
 * After each frame: checks the step, moves on when it's done, and keeps the guided part safe (changes `round`):
 * full HP for both, the clock stopped, and enough PP for the special step. The free fight starts with the rival at
 * half HP, so it doesn't drag on.
 */
export function afterFrame(t: TutorialState, round: FightState, events: readonly FightEvent[]): TutorialState {
  let next = t;
  if (currentStep(t) === 'move' && round.fighters[0].action === 'walkForward') next = { ...next, walked: next.walked + 1 };
  if (stepDone(next, round, events)) next = { ...next, step: next.step + 1, walked: 0 };

  if (isGuided(next)) {
    for (const f of round.fighters) f.hp = f.maxHp;
    round.timer = ROUND_FRAMES;
    if (currentStep(next) === 'special') round.fighters[0].pp = Math.max(round.fighters[0].pp, ELEMENTAL_COST);
  } else if (isGuided(t)) {
    // The free fight starts now.
    const [player, rival] = round.fighters;
    player.hp = player.maxHp;
    rival.hp = Math.ceil(rival.maxHp / 2);
    round.timer = ROUND_FRAMES;
  }
  return next;
}
