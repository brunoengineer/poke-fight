// Helpers for the fight tests: run scripted inputs frame by frame and collect what happened.

import { px } from './constants';
import type { InputMask } from './input';
import { createFight, type FightEvent, type FightOptions, type FightState } from './state';
import { step } from './step';

/** Player input for a frame: a fixed mask, or a function of the frame number (1 = the first simulated frame). */
export type Script = InputMask | ((frame: number) => InputMask);

const inputAt = (script: Script, frame: number) => (typeof script === 'number' ? script : script(frame));

export interface Run {
  /** The state after each frame: frames[0] is after frame 1. */
  frames: FightState[];
  events: (FightEvent & { frame: number })[];
  final: FightState;
}

export function run(frameCount: number, p1: Script = 0, p2: Script = 0, start: FightState = createFight()): Run {
  let state = start;
  const frames: FightState[] = [];
  const events: Run['events'] = [];
  for (let i = 0; i < frameCount; i++) {
    const frame = state.frame + 1;
    const result = step(state, [inputAt(p1, frame), inputAt(p2, frame)]);
    state = result.state;
    frames.push(state);
    events.push(...result.events.map(e => ({ ...e, frame })));
  }
  return { frames, events, final: state };
}

/** The state after a given frame (1-based). */
export const at = (r: Run, frame: number) => r.frames[frame - 1];

/** Presses (holds) a button only on these frames. */
export const on = (mask: InputMask, ...frames: number[]) => (frame: number) => (frames.includes(frame) ? mask : 0);

/** Holds a button from one frame to another (inclusive). */
export const between = (mask: InputMask, from: number, to: number) => (frame: number) =>
  frame >= from && frame <= to ? mask : 0;

/** Fighters this many pixels apart (centers), in the middle of the arena. */
export function fightAt(distance: number, options: Omit<FightOptions, 'x'> = {}): FightState {
  const center = 240;
  return createFight({ ...options, x: [px(center - distance / 2), px(center + distance / 2)] });
}
