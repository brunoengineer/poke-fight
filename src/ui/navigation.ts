// Moving around the menus without a mouse: arrow keys or a controller's d-pad move the focus between buttons,
// A (or Enter) presses the focused one, B presses the screen's Back button.

// Buttons only: in a dropdown the arrows change its value, so it stays reachable with Tab or the mouse.
const FOCUSABLE = 'button:not([disabled])';

/** The menu's buttons, in reading order. */
export const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)];

/** Moves the focus to the next (+1) or previous (-1) button, wrapping around. Nothing focused yet: the main button. */
export function moveFocus(root: HTMLElement, delta: 1 | -1) {
  const items = focusables(root);
  if (items.length === 0) return;
  const at = items.indexOf(document.activeElement as HTMLElement);
  if (at === -1) {
    (root.querySelector<HTMLElement>('[data-primary]:not([disabled])') ?? items[0]).focus();
    return;
  }
  items[(at + delta + items.length) % items.length].focus();
}

/** A controller's A: the focused button, or the main one. */
export function pressFocused(root: HTMLElement) {
  const focused = document.activeElement;
  if (focused instanceof HTMLButtonElement && root.contains(focused)) focused.click();
  else root.querySelector<HTMLButtonElement>('[data-primary]:not([disabled])')?.click();
}

/** A controller's B: the screen's Back (or Close) button, if it has one. */
export function pressBack(root: HTMLElement): boolean {
  const back = root.querySelector<HTMLButtonElement>('[data-back]:not([disabled])');
  back?.click();
  return back !== null;
}
