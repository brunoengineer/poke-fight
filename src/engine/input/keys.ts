// Keyboard → input mask, without the DOM (the listeners are in keyboard.ts), so it can be tested directly.
//
// A key pressed since the last sample always counts on the next frame, even if it was already released: a tap
// shorter than one frame (16.7 ms) is never lost.

import { Button, type InputMask } from '../../fight/input';

/** KeyboardEvent.code → button. `code` is the physical key, so the layout (QWERTY, AZERTY…) doesn't matter. */
export type Bindings = Readonly<Record<string, number>>;

export const DEFAULT_BINDINGS: Bindings = {
  KeyA: Button.Left,
  ArrowLeft: Button.Left,
  KeyD: Button.Right,
  ArrowRight: Button.Right,
  KeyW: Button.Up,
  ArrowUp: Button.Up,
  KeyS: Button.Down,
  ArrowDown: Button.Down,
  KeyJ: Button.Physical,
  KeyK: Button.Special,
  KeyI: Button.Big,
  KeyL: Button.Guard,
  Space: Button.Dash,
};

export interface KeyLatch {
  isBound(code: string): boolean;
  down(code: string): void;
  up(code: string): void;
  /** Forgets every key (the window lost focus: key-up events would never arrive). */
  clear(): void;
  /** The mask for the next frame: keys held now, plus keys pressed since the last sample. */
  sample(): InputMask;
}

export function createKeyLatch(bindings: Bindings = DEFAULT_BINDINGS): KeyLatch {
  const held = new Set<string>();
  let pressedSinceSample: InputMask = 0;
  const isBound = (code: string) => Object.hasOwn(bindings, code);
  return {
    isBound,
    down(code) {
      if (!isBound(code)) return;
      held.add(code);
      pressedSinceSample |= bindings[code];
    },
    up(code) {
      held.delete(code);
    },
    clear() {
      held.clear();
      pressedSinceSample = 0;
    },
    sample() {
      let mask = pressedSinceSample;
      for (const code of held) mask |= bindings[code];
      pressedSinceSample = 0;
      return mask;
    },
  };
}
