// Controllers, through the browser Gamepad API. Pads are read once per frame (the API has no events for buttons).
// Uses the "standard" layout (Xbox names; on PlayStation: A = ✕, B = ○, X = □, Y = △, RB = R1).

import { Button, type InputMask } from '../../fight/input';

export const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, Back: 8, Start: 9, Up: 12, Down: 13, Left: 14, Right: 15 } as const;

/** How far the left stick must be pushed to count as a direction. */
export const STICK_DEADZONE = 0.5;

/** The parts of a Gamepad we read (so tests can pass plain objects). */
export interface PadLike {
  buttons: readonly { pressed: boolean }[];
  axes: readonly number[];
}

export function padMask(pad: PadLike): InputMask {
  const on = (index: number) => pad.buttons[index]?.pressed === true;
  const [stickX = 0, stickY = 0] = pad.axes;
  let mask = 0;
  if (on(PAD.Left) || stickX <= -STICK_DEADZONE) mask |= Button.Left;
  if (on(PAD.Right) || stickX >= STICK_DEADZONE) mask |= Button.Right;
  if (on(PAD.Up) || on(PAD.A) || stickY <= -STICK_DEADZONE) mask |= Button.Up;
  if (on(PAD.Down) || stickY >= STICK_DEADZONE) mask |= Button.Down;
  if (on(PAD.X)) mask |= Button.Physical;
  if (on(PAD.Y)) mask |= Button.Special;
  if (on(PAD.B)) mask |= Button.Big | Button.Cancel;
  if (on(PAD.A)) mask |= Button.Confirm;
  if (on(PAD.RB)) mask |= Button.Guard;
  if (on(PAD.LB)) mask |= Button.Dash;
  return mask;
}

/** The buttons that drive the menus. */
export interface MenuPad {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  lb: boolean;
  rb: boolean;
}

export const NO_MENU_PAD: MenuPad = { up: false, down: false, left: false, right: false, a: false, b: false, x: false, y: false, lb: false, rb: false };

export function padMenu(pad: PadLike): MenuPad {
  const on = (index: number) => pad.buttons[index]?.pressed === true;
  const [stickX = 0, stickY = 0] = pad.axes;
  return {
    up: on(PAD.Up) || stickY <= -STICK_DEADZONE,
    down: on(PAD.Down) || stickY >= STICK_DEADZONE,
    left: on(PAD.Left) || stickX <= -STICK_DEADZONE,
    right: on(PAD.Right) || stickX >= STICK_DEADZONE,
    a: on(PAD.A),
    b: on(PAD.B),
    x: on(PAD.X),
    y: on(PAD.Y),
    lb: on(PAD.LB),
    rb: on(PAD.RB),
  };
}

export interface PadReading {
  mask: InputMask;
  start: boolean;
  /** The View / Back / Select button (switching Pokémon in a fight). */
  view: boolean;
  menu: MenuPad;
}

/** Reads the first connected controller (player 1). */
export function readFirstPad(): PadReading {
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  const pad = pads.find(p => p?.connected);
  if (!pad) return { mask: 0, start: false, view: false, menu: NO_MENU_PAD };
  return { mask: padMask(pad), start: pad.buttons[PAD.Start]?.pressed === true, view: pad.buttons[PAD.Back]?.pressed === true, menu: padMenu(pad) };
}

/** Every connected controller, in the browser's order (Versus: player 2 needs its own). */
export function readPads(): PadReading[] {
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  return pads.flatMap(pad =>
    pad?.connected ? [{ mask: padMask(pad), start: pad.buttons[PAD.Start]?.pressed === true, view: pad.buttons[PAD.Back]?.pressed === true, menu: padMenu(pad) }] : [],
  );
}

/**
 * Who plays with what in Versus (plan.md §4.10): with two controllers, player 1 has the first (and the keyboard) and
 * player 2 the second; with one, player 1 has the keyboard and player 2 the controller; with none, player 2 waits for
 * one. Indexes into readPads().
 */
export function versusSeats(pads: number): { p1Pad: number | null; p2Pad: number | null } {
  if (pads >= 2) return { p1Pad: 0, p2Pad: 1 };
  if (pads === 1) return { p1Pad: null, p2Pad: 0 };
  return { p1Pad: null, p2Pad: null };
}

/** A menu reading from an input mask (a fake controller in the browser tests). */
export function maskMenu(mask: InputMask): MenuPad {
  return {
    ...NO_MENU_PAD,
    up: (mask & Button.Up) !== 0,
    down: (mask & Button.Down) !== 0,
    left: (mask & Button.Left) !== 0,
    right: (mask & Button.Right) !== 0,
    a: (mask & Button.Confirm) !== 0,
    b: (mask & Button.Cancel) !== 0,
    lb: (mask & Button.Dash) !== 0,
    rb: (mask & Button.Guard) !== 0,
  };
}
