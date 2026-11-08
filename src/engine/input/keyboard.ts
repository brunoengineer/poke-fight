// Connects the browser's keyboard events to a KeyLatch, plus a few command keys (debug overlay, reset…).

import type { KeyLatch } from './keys';

/** KeyboardEvent.code → what to do when it is pressed. */
export type Commands = Readonly<Record<string, () => void>>;

export interface KeyboardOptions {
  /** While true (a menu is open), the game ignores keys, so Enter, Space and arrows work on the menu. */
  paused?: () => boolean;
  /** Commands that still work while paused (opening/closing menus). */
  alwaysOn?: readonly string[];
}

export function attachKeyboard(target: Window, latch: KeyLatch, commands: Commands, options: KeyboardOptions = {}): () => void {
  const onDown = (event: KeyboardEvent) => {
    // Leave browser shortcuts alone (Ctrl+R reloads, Alt+Tab…).
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    // Typing in a text field (a name) or choosing in a dropdown: the keys are for it.
    if (event.target instanceof HTMLElement && event.target.matches('input, textarea, select')) return;
    if (options.paused?.()) {
      if (options.alwaysOn?.includes(event.code) && Object.hasOwn(commands, event.code)) {
        event.preventDefault();
        if (!event.repeat) commands[event.code]();
      }
      return;
    }
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
