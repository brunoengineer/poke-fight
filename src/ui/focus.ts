// Menus without a mouse (a controller first): the focus moves on screen by direction (spatial.ts), stays where it was
// when a screen redraws (buying an item keeps you on that item), follows the mouse, and buttons can carry shortcuts
// for a controller's X / Y / LB / RB and keyboard keys. The hint bar shows the glyphs of the device in use.

import { pickInDirection, type Direction } from './spatial';

/** What can get the focus: enabled buttons and anything marked focusable (a disabled card can still be read). */
const FOCUSABLE = 'button:not([disabled]), [data-focusable]';

/** A picker or a sheet over the screen keeps the focus inside it. */
const scopeOf = (root: HTMLElement): HTMLElement => {
  const layers = root.querySelectorAll<HTMLElement>('[data-nav-scope]');
  return layers.length ? layers[layers.length - 1] : root;
};

const visible = (element: HTMLElement) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden';

export const focusables = (root: HTMLElement) => [...scopeOf(root).querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);

const isUsable = (element: Element | null): element is HTMLElement => element instanceof HTMLElement && element.matches(FOCUSABLE);

function focus(element: HTMLElement) {
  element.focus({ preventScroll: true });
  // Keep it in view inside scrolling lists (the shop, the box), without jumping the whole screen.
  element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

/** The screen's starting point: what it asks for, else its main button, else the first button. */
function initialFocus(root: HTMLElement): HTMLElement | null {
  const scope = scopeOf(root);
  return (
    scope.querySelector<HTMLElement>('[data-autofocus]:not([disabled])') ??
    scope.querySelector<HTMLElement>('[data-primary]:not([disabled])') ??
    focusables(root)[0] ??
    null
  );
}

/** Moves the focus one step in a direction. Lists marked `data-nav-wrap` go around at their ends. */
export function moveFocus(root: HTMLElement, direction: Direction) {
  const items = focusables(root);
  if (items.length === 0) return;
  const current = document.activeElement;
  if (!(current instanceof HTMLElement) || !items.includes(current)) {
    const start = initialFocus(root);
    if (start) focus(start);
    return;
  }
  const wrap = current.closest('[data-nav-wrap]') !== null;
  const rects = items.map(item => item.getBoundingClientRect());
  const next = pickInDirection(current.getBoundingClientRect(), rects, direction, wrap);
  if (next !== -1) focus(items[next]);
}

/** A controller's A: the focused button, or the main one. */
export function pressFocused(root: HTMLElement) {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement && root.contains(focused) && focused.matches('button:not([disabled])')) focused.click();
  else scopeOf(root).querySelector<HTMLButtonElement>('[data-primary]:not([disabled])')?.click();
}

/** A controller's B (or Esc): the screen's Back / Close / Cancel button, if it has one. */
export function pressBack(root: HTMLElement): boolean {
  const back = scopeOf(root).querySelector<HTMLButtonElement>('[data-back]:not([disabled])');
  back?.click();
  return back !== null;
}

/** A shortcut: the button marked with this controller button (`data-pad="x"`) or key (`data-key="KeyX"`). */
export function pressShortcut(root: HTMLElement, selector: string): boolean {
  const target = scopeOf(root).querySelector<HTMLButtonElement>(`${selector}:not([disabled])`);
  target?.click();
  return target !== null;
}

/**
 * Shows a screen. If the same screen is redrawn (same `data-testid` on its root), the focus goes back to the same
 * button; otherwise to the screen's starting point.
 */
export function mount(root: HTMLElement, screen: HTMLElement) {
  const before = root.firstElementChild instanceof HTMLElement ? root.firstElementChild.dataset.testid : undefined;
  const focused = document.activeElement instanceof HTMLElement && root.contains(document.activeElement) ? document.activeElement : null;
  const focusedId = focused?.dataset.testid;
  const same = before !== undefined && before === screen.dataset.testid;
  // The same screen drawn again (a change on it): it doesn't rise in again, only what changed moves.
  if (same) screen.dataset.redraw = '';
  root.replaceChildren(screen);
  const again = same && focusedId ? root.querySelector<HTMLElement>(`[data-testid="${CSS.escape(focusedId)}"]`) : null;
  // A text field (a name) takes the keyboard first.
  const field = root.querySelector<HTMLInputElement>('input[data-autofocus]');
  if (field) {
    field.focus();
    field.select();
    return;
  }
  const target = isUsable(again) ? again : initialFocus(root);
  if (target) focus(target);
}

/** Re-focuses the screen's starting point (after a sheet closes). */
export function focusStart(root: HTMLElement) {
  const start = initialFocus(root);
  if (start) focus(start);
}

export type InputDevice = 'keys' | 'pad' | 'mouse';

/**
 * Remembers which device the player is using and writes it on the frame (`data-input`), so the hints show Ⓐ / Ⓑ for a
 * controller and Enter / Esc for a keyboard, without redrawing anything. Moving the mouse over a button focuses it.
 */
export function trackInput(frame: HTMLElement, overlay: HTMLElement) {
  let device: InputDevice = 'keys';
  const use = (next: InputDevice) => {
    if (next === device) return;
    device = next;
    frame.dataset.input = next;
  };
  frame.dataset.input = device;
  window.addEventListener('keydown', () => use('keys'), true);
  window.addEventListener('pointerdown', () => use('mouse'), true);
  overlay.addEventListener('pointermove', event => {
    if (event.movementX === 0 && event.movementY === 0) return;
    use('mouse');
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>(FOCUSABLE) : null;
    if (target && target !== document.activeElement && overlay.contains(target)) target.focus({ preventScroll: true });
  });
  return { usePad: () => use('pad'), device: () => device };
}
