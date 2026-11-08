// Connects the browser's keyboard events to a KeyLatch, plus a few command keys (debug overlay, reset…).

import type { KeyLatch } from './keys';

/** KeyboardEvent.code → what to do when it is pressed. */
export type Commands = Readonly<Record<string, () => void>>;

export function attachKeyboard(target: Window, latch: KeyLatch, commands: Commands): () => void {
  const onDown = (event: KeyboardEvent) => {
    // Leave browser shortcuts alone (Ctrl+R reloads, Alt+Tab…).
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (Object.hasOwn(commands, event.code)) {
      event.preventDefault();
      if (!event.repeat) commands[event.code]();
      return;
    }
    if (latch.isBound(event.code)) {
      // Arrow keys would scroll the page, F1 would open the browser's help.
      event.preventDefault();
      if (!event.repeat) latch.down(event.code);
    }
  };
  const onUp = (event: KeyboardEvent) => latch.up(event.code);
  const onBlur = () => latch.clear();

  target.addEventListener('keydown', onDown);
  target.addEventListener('keyup', onUp);
  target.addEventListener('blur', onBlur);
  return () => {
    target.removeEventListener('keydown', onDown);
    target.removeEventListener('keyup', onUp);
    target.removeEventListener('blur', onBlur);
  };
}
