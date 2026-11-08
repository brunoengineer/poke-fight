// Runs the rival tutorial inside the fight screen: plays the rival and shows each instruction (game/tutorial.ts has
// the rules).

import { afterFrame, createTutorial, currentStep, GUIDED_STEPS, rivalInput, type TutorialStep } from '../game/tutorial';
import type { Director } from './sandbox';

export interface TutorialDirector extends Director {
  step(): TutorialStep;
}

/** `rival`: the rival's name; `move`: the player's elemental special (shown in the special step). */
export function createTutorialDirector(seed: number, rival: string, move: string): TutorialDirector {
  let state = createTutorial(seed);
  return {
    input(round) {
      const result = rivalInput(state, round);
      state = result.tutorial;
      return result.input;
    },
    after(round, events) {
      state = afterFrame(state, round, events);
    },
    banner() {
      const step = currentStep(state);
      return {
        step: step === 'finish' ? null : { number: state.step + 1, total: GUIDED_STEPS },
        key: `tutorial.${step}`,
        params: { rival, move },
      };
    },
    describe: () => `tutorial: ${currentStep(state)}`,
    step: () => currentStep(state),
  };
}
