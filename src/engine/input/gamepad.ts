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
  if (on(PAD.B)) mask |= Button.Big;
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
}

export const NO_MENU_PAD: MenuPad = { up: false, down: false, left: false, right: false, a: false, b: false };

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
  };
}

export interface PadReading {
  mask: InputMask;
  start: boolean;
  menu: MenuPad;
}

/** Reads the first connected controller (player 1). */
export function readFirstPad(): PadReading {
  const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
  const pad = pads.find(p => p?.connected);
  if (!pad) return { mask: 0, start: false, menu: NO_MENU_PAD };
  return { mask: padMask(pad), start: pad.buttons[PAD.Start]?.pressed === true, menu: padMenu(pad) };
}
