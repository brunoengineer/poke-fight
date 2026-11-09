import { describe, expect, it } from 'vitest';
import { Button, cleanDirections } from '../../fight/input';
import { PAD, STICK_DEADZONE, padMask, padMenu, type PadLike } from './gamepad';
import { HISTORY_MAX_FRAMES, pushHistory, type HistoryEntry } from './history';
import { createKeyLatch } from './keys';

describe('keyboard latch', () => {
  it('a held key counts on every frame', () => {
    const keys = createKeyLatch();
    keys.down('KeyD');
    expect([keys.sample(), keys.sample()]).toEqual([Button.Right, Button.Right]);
    keys.up('KeyD');
    expect(keys.sample()).toBe(0);
  });

  it('a tap shorter than one frame still counts, once', () => {
    const keys = createKeyLatch();
    keys.down('KeyJ');
    keys.up('KeyJ');
    expect(keys.sample()).toBe(Button.Physical);
    expect(keys.sample()).toBe(0);
  });

  it('Space is the dash button', () => {
    const keys = createKeyLatch();
    keys.down('Space');
    expect(keys.sample()).toBe(Button.Dash);
  });

  it('WASD and the arrows do the same', () => {
    const keys = createKeyLatch();
    keys.down('ArrowUp');
    keys.down('KeyA');
    expect(keys.sample()).toBe(Button.Up | Button.Left);
  });

  it('ignores keys that are not bound', () => {
    const keys = createKeyLatch();
    keys.down('KeyZ');
    expect(keys.isBound('KeyZ')).toBe(false);
    expect(keys.sample()).toBe(0);
  });

  it('clear() releases everything (the window lost focus)', () => {
    const keys = createKeyLatch();
    keys.down('KeyD');
    keys.clear();
    expect(keys.sample()).toBe(0);
  });
});

describe('controller', () => {
  const pad = (pressed: number[] = [], axes: number[] = [0, 0]): PadLike => ({
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i) })),
    axes,
  });

  it('in menus: the d-pad or the stick move, A confirms, B goes back', () => {
    expect(padMenu(pad([PAD.Down, PAD.A]))).toEqual({ up: false, down: true, left: false, right: false, a: true, b: false, x: false, y: false, lb: false, rb: false });
    expect(padMenu(pad([PAD.Y, PAD.RB]))).toMatchObject({ y: true, rb: true, x: false, lb: false });
    expect(padMenu(pad([PAD.B], [0, -0.9]))).toMatchObject({ up: true, b: true, a: false });
  });

  it('maps the d-pad and the face buttons', () => {
    expect(padMask(pad([PAD.Left]))).toBe(Button.Left);
    // A jumps, and confirms on the battle's menus; B is the big special, and cancels there.
    expect(padMask(pad([PAD.A]))).toBe(Button.Up | Button.Confirm);
    expect(padMask(pad([PAD.X]))).toBe(Button.Physical);
    expect(padMask(pad([PAD.Y]))).toBe(Button.Special);
    expect(padMask(pad([PAD.B]))).toBe(Button.Big | Button.Cancel);
    expect(padMask(pad([PAD.RB]))).toBe(Button.Guard);
    expect(padMask(pad([PAD.LB]))).toBe(Button.Dash);
  });

  it('reads the left stick past the dead zone only', () => {
    expect(padMask(pad([], [STICK_DEADZONE - 0.01, 0]))).toBe(0);
    expect(padMask(pad([], [STICK_DEADZONE, 0]))).toBe(Button.Right);
    expect(padMask(pad([], [-0.9, -0.9]))).toBe(Button.Left | Button.Up);
  });

  it('works with pads that report fewer buttons', () => {
    expect(padMask({ buttons: [{ pressed: true }], axes: [] })).toBe(Button.Up | Button.Confirm);
  });
});

describe('opposite directions', () => {
  it('cancel out, buttons stay', () => {
    expect(cleanDirections(Button.Left | Button.Right | Button.Physical)).toBe(Button.Physical);
    expect(cleanDirections(Button.Up | Button.Down | Button.Left)).toBe(Button.Left);
  });
});

describe('input history', () => {
  it('counts frames of the same input, newest first', () => {
    let history: HistoryEntry[] = [];
    for (const mask of [0, 0, Button.Right, Button.Right, Button.Right | Button.Physical]) history = pushHistory(history, mask);
    expect(history).toEqual([
      { mask: Button.Right | Button.Physical, frames: 1 },
      { mask: Button.Right, frames: 2 },
      { mask: 0, frames: 2 },
    ]);
  });

  it('keeps a limited number of rows and caps the count', () => {
    let history: HistoryEntry[] = [];
    for (let i = 0; i < 30; i++) history = pushHistory(history, i % 2, 5);
    expect(history).toHaveLength(5);
    for (let i = 0; i < 200; i++) history = pushHistory(history, 7, 5);
    expect(history[0].frames).toBe(HISTORY_MAX_FRAMES);
  });
});
