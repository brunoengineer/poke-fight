// The throw's timing: each wobble after the drop, the end after the last one.

import { describe, expect, it } from 'vitest';
import { CAPTURE_TIMING, captureSchedule } from './capture';

describe('a throw', () => {
  it('wobbles as many times as the ball shook, then ends', () => {
    const t = CAPTURE_TIMING;
    expect(captureSchedule(0)).toEqual({ absorb: t.throw, drop: t.throw + t.absorb, shakesAt: [], end: t.throw + t.absorb + t.drop + t.settle });
    const three = captureSchedule(3);
    expect(three.shakesAt).toHaveLength(3);
    expect(three.shakesAt[1] - three.shakesAt[0]).toBe(t.shake);
    expect(three.end).toBe(three.shakesAt[2] + t.shake + t.settle);
  });
});
