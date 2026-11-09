import { describe, expect, it } from 'vitest';
import { Button } from '../fight/input';
import { createKeyLatch } from '../engine/input/keys';
import { bindingsOf, DEFAULT_KEYS, DEFAULT_SETTINGS, DEFAULT_VOLUMES, keyLabel, keyNames, parseSettings, rebind, stepVolume } from './settings';
import { gainOf } from '../audio/audio';

describe('settings', () => {
  it('nothing stored, or garbage: the defaults', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{oops')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps what is valid and fixes the rest', () => {
    const stored = JSON.stringify({ muted: true, keys: { physical: 'KeyU', guard: 'Escape', big: 7 } });
    expect(parseSettings(stored)).toEqual({ muted: true, volumes: DEFAULT_VOLUMES, keys: { ...DEFAULT_KEYS, physical: 'KeyU' }, language: null });
    expect(parseSettings(JSON.stringify({ language: 'pt' })).language).toBe('pt');
    expect(parseSettings(JSON.stringify({ language: 'xx' })).language).toBeNull();
  });

  it('volumes: 0–10 each, kept when valid; the cries start low', () => {
    expect(parseSettings(JSON.stringify({ volumes: { music: 9, sounds: 11, cries: 'x' } })).volumes).toEqual({ ...DEFAULT_VOLUMES, music: 9 });
    expect(stepVolume(DEFAULT_VOLUMES, 'cries', -5).cries).toBe(0);
    expect(stepVolume({ ...DEFAULT_VOLUMES, music: 10 }, 'music', 1).music).toBe(10);
    // At the defaults, a cry (a full-loudness recording) plays well under the effects and close to the music.
    expect(gainOf('cries', DEFAULT_VOLUMES.cries)).toBeLessThan(gainOf('music', DEFAULT_VOLUMES.music));
    expect(gainOf('music', DEFAULT_VOLUMES.music)).toBeCloseTo(0.16, 2);
    expect(gainOf('music', 0)).toBe(0);
  });

  it('Enter confirms on the battle menus, and a controller has its own confirm', () => {
    expect(bindingsOf(DEFAULT_KEYS).Enter).toBe(Button.Confirm);
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
