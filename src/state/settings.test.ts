import { describe, expect, it } from 'vitest';
import { Button } from '../fight/input';
import { createKeyLatch } from '../engine/input/keys';
import { bindingsOf, DEFAULT_KEYS, DEFAULT_SETTINGS, keyLabel, keyNames, parseSettings, rebind } from './settings';

describe('settings', () => {
  it('nothing stored, or garbage: the defaults', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps what is valid and fixes the rest', () => {
    const stored = JSON.stringify({ muted: true, keys: { physical: 'KeyU', guard: 'Escape', big: 7 } });
    expect(parseSettings(stored)).toEqual({ muted: true, keys: { ...DEFAULT_KEYS, physical: 'KeyU' } });
  });

  it('two actions on the same key (a hand-edited file): back to the default keys', () => {
    const stored = JSON.stringify({ keys: { ...DEFAULT_KEYS, special: 'KeyJ' } });
    expect(parseSettings(stored).keys).toEqual(DEFAULT_KEYS);
  });

  it('rebinding to a key another action uses swaps the two', () => {
    const keys = rebind(DEFAULT_KEYS, 'physical', 'KeyK');
    expect(keys).toMatchObject({ physical: 'KeyK', special: 'KeyJ' });
    expect(rebind(DEFAULT_KEYS, 'dash', 'KeyU')).toMatchObject({ dash: 'KeyU', physical: 'KeyJ' });
  });

  it('the game’s command keys and the arrows can’t be taken', () => {
    for (const code of ['F1', 'KeyP', 'KeyR', 'KeyM', 'Escape', 'Enter', 'ArrowUp']) expect(rebind(DEFAULT_KEYS, 'physical', code)).toBeNull();
  });

  it('the latch follows new bindings; the arrows always move', () => {
    const latch = createKeyLatch(bindingsOf(DEFAULT_KEYS));
    latch.setBindings(bindingsOf(rebind(DEFAULT_KEYS, 'physical', 'KeyU')!));
    latch.down('KeyU');
    latch.down('ArrowLeft');
    expect(latch.sample()).toBe(Button.Physical | Button.Left);
    latch.down('KeyJ');
    expect(latch.isBound('KeyJ')).toBe(false);
  });

  it('writes keys the way the screen shows them', () => {
    expect(['KeyJ', 'Digit4', 'Space', 'ShiftLeft', 'ArrowUp', 'Semicolon'].map(keyLabel)).toEqual(['J', '4', 'Space', 'Shift', '↑', ';']);
    expect(keyNames(DEFAULT_KEYS)).toMatchObject({ keyPhysical: 'J', keyDash: 'Space', keyUp: 'W' });
  });
});
