// The training dummy: simple fixed behaviors for practice (the sandbox also offers the CPU). F2 cycles them.

import { Button, type InputMask } from './input';

export const DUMMY_MODES = ['stand', 'jump', 'attack', 'guard', 'special'] as const;
export type DummyMode = (typeof DUMMY_MODES)[number];

/** How often the dummy presses its attack in 'attack' mode, and its elemental special in 'special' mode. */
export const DUMMY_ATTACK_EVERY = 30;
export const DUMMY_SPECIAL_EVERY = 60;

export function dummyInput(mode: DummyMode, frame: number): InputMask {
  switch (mode) {
    case 'stand':
      return 0;
    case 'jump':
      return Button.Up; // held: it jumps again as soon as it lands
    case 'attack':
      return frame % DUMMY_ATTACK_EVERY === 0 ? Button.Physical : 0;
    case 'guard':
      return Button.Guard;
    case 'special':
      return frame % DUMMY_SPECIAL_EVERY === 0 ? Button.Special : 0;
  }
}
