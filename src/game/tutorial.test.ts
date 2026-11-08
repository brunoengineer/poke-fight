// The rival tutorial, played by a scripted player: every step must be reachable, checked from real fight events,
// and the guided part must be safe.

import { describe, expect, it } from 'vitest';
import { ELEMENTAL_COST, ROUND_FRAMES, SUB } from '../fight/constants';
import { Button, type InputMask } from '../fight/input';
import { createFight, type FightState } from '../fight/state';
import { step } from '../fight/step';
import { toFighter } from './pokemon';
import { createStarter, RIVAL_PICK } from './story';
import { afterFrame, createTutorial, currentStep, rivalInput, type TutorialState, type TutorialStep } from './tutorial';

const { Left, Right, Up, Physical, Special, Guard, Dash } = Button;

function start() {
  const state = createFight({ fighters: [toFighter(createStarter(4)), toFighter(createStarter(RIVAL_PICK[4]))] });
  return { state, tutorial: createTutorial(1) };
}

/** Plays frames: `player` decides player 1's input from the current step and state. */
function play(
  frames: number,
  player: (step: TutorialStep, state: FightState, frame: number) => InputMask,
  from = start(),
  stopWhen: (t: TutorialState, s: FightState) => boolean = () => false,
) {
  let { state, tutorial } = from;
  const seen: TutorialStep[] = [currentStep(tutorial)];
  for (let frame = 1; frame <= frames && !stopWhen(tutorial, state); frame++) {
    const rival = rivalInput(tutorial, state);
    tutorial = rival.tutorial;
    const result = step(state, [player(currentStep(tutorial), state, frame), rival.input]);
    state = result.state;
    tutorial = afterFrame(tutorial, state, result.events);
    if (seen.at(-1) !== currentStep(tutorial)) seen.push(currentStep(tutorial));
  }
  return { state, tutorial, seen };
}

/** A player who does what each instruction says (pressing buttons on every other frame, like a person would). */
function obedient(stepName: TutorialStep, state: FightState, frame: number): InputMask {
  const [me, rival] = state.fighters;
  const forward = me.facing === 1 ? Right : Left;
  const distance = Math.abs(rival.x - me.x) / SUB;
  const press = (button: number) => (frame % 2 === 0 ? button : 0);
  switch (stepName) {
    case 'move':
      return forward;
    case 'jump':
      return press(Up);
    case 'tackle':
    case 'finish':
      return distance > 40 ? forward : press(Physical);
    case 'air':
      // A jump-in: from mid range, jump towards the rival and attack on the way down.
      if (me.action === 'jump') return me.vy < 0 && me.y < 80 * SUB ? press(Physical) : 0;
      if (distance > 90) return forward;
      if (distance < 60) return me.facing === 1 ? Left : Right;
      return press(Up) | forward;
    case 'guard':
      return Guard;
    case 'dash':
      return press(Dash);
    case 'special':
      return press(Special);
  }
}

describe('rival tutorial', () => {
  it('a player who follows the instructions goes through every step, in order, and then the free fight', () => {
    const { seen } = play(6000, obedient, start(), t => currentStep(t) === 'finish');
    expect(seen).toEqual(['move', 'jump', 'tackle', 'air', 'guard', 'dash', 'special', 'finish']);
  });

  it('steps are checked from what really happens: walking backwards is not "walk towards the rival"', () => {
    const { tutorial } = play(120, () => Left);
    expect(currentStep(tutorial)).toBe('move');
  });

  it('nobody can be knocked out and the clock stops during the guided steps', () => {
    // Stuck on the guard step, never guarding: the rival keeps hitting.
    const { state, tutorial } = play(2000, (s, st, f) => (s === 'guard' ? 0 : obedient(s, st, f)));
    expect(currentStep(tutorial)).toBe('guard');
    expect(state.winner).toBeNull();
    expect(state.fighters.map(f => f.hp)).toEqual(state.fighters.map(f => f.maxHp));
    expect(state.timer).toBe(ROUND_FRAMES);
  });

  it('the rival only attacks in the guard step', () => {
    const { state } = play(3000, (s, st, f) => (s === 'guard' ? 0 : obedient(s, st, f)));
    // The rival walked up to the player to attack.
    expect(Math.abs(state.fighters[0].x - state.fighters[1].x) / SUB).toBeLessThanOrEqual(50);
  });

  it('the special step always has enough PP', () => {
    const { state } = play(6000, obedient, start(), t => currentStep(t) === 'special');
    expect(state.fighters[0].pp).toBeGreaterThanOrEqual(ELEMENTAL_COST);
  });

  it('the free fight starts with the rival at half HP, and ends the battle', () => {
    const atFinish = play(6000, obedient, start(), t => currentStep(t) === 'finish');
    const rival = atFinish.state.fighters[1];
    expect(rival.hp).toBe(Math.ceil(rival.maxHp / 2));
    const end = play(99 * 60, obedient, { state: atFinish.state, tutorial: atFinish.tutorial }, (_, s) => s.winner !== null);
    expect(end.state.winner).not.toBeNull();
  });
});
