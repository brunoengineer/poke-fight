// Player settings that belong to the device, not to a journey: sound on/off and the keyboard controls.
// Kept apart from the save (state/save.ts), so a new game keeps them and Training (no save) can use them.

import { Button } from '../fight/input';
import type { Bindings } from '../engine/input/keys';
import { isLanguage, type Language } from '../i18n';

export const SETTINGS_KEY = 'poke-fight.settings';

/** The fight's actions that have a key. */
export const ACTIONS = ['up', 'left', 'down', 'right', 'physical', 'special', 'big', 'guard', 'dash'] as const;
export type Action = (typeof ACTIONS)[number];

export const ACTION_BUTTON: Record<Action, number> = {
  up: Button.Up,
  left: Button.Left,
  down: Button.Down,
  right: Button.Right,
  physical: Button.Physical,
  special: Button.Special,
  big: Button.Big,
  guard: Button.Guard,
  dash: Button.Dash,
};

/** One key per action (KeyboardEvent.code). The arrow keys always move too. */
export type KeyMap = Record<Action, string>;

export const DEFAULT_KEYS: KeyMap = {
  up: 'KeyW',
  left: 'KeyA',
  down: 'KeyS',
  right: 'KeyD',
  physical: 'KeyJ',
  special: 'KeyK',
  big: 'KeyI',
  guard: 'KeyL',
  dash: 'Space',
};

const ARROWS: Readonly<Record<string, Action>> = { ArrowUp: 'up', ArrowLeft: 'left', ArrowDown: 'down', ArrowRight: 'right' };

/**
 * Keys that can't be given to an action: the game's commands (debug, party, reset, mute, leave), the arrows (they
 * always move), and keys browsers or menus need (Enter, Tab).
 */
export const RESERVED_KEYS: ReadonlySet<string> = new Set([
  'F1', 'F2', 'F3', 'F4', 'KeyP', 'KeyR', 'KeyM', 'Escape', 'Enter', 'NumpadEnter', 'Tab',
  ...Object.keys(ARROWS),
]);

export interface Settings {
  muted: boolean;
  keys: KeyMap;
  /** The language chosen on this device (null: follow the browser, or the save). */
  language: Language | null;
}

export const DEFAULT_SETTINGS: Settings = { muted: false, keys: DEFAULT_KEYS, language: null };

/** Reads stored settings, keeping whatever is valid and using the defaults for the rest (never fails). */
export function parseSettings(raw: string | null): Settings {
  let data: unknown;
  try {
    data = raw === null ? null : JSON.parse(raw);
  } catch {
    data = null;
  }
  if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
  const { muted, keys, language } = data as { muted?: unknown; keys?: unknown; language?: unknown };
  let map = DEFAULT_KEYS;
  if (typeof keys === 'object' && keys !== null) {
    const stored = keys as Record<string, unknown>;
    const candidate = Object.fromEntries(
      ACTIONS.map(a => [a, typeof stored[a] === 'string' && !RESERVED_KEYS.has(stored[a] as string) ? stored[a] : DEFAULT_KEYS[a]]),
    ) as KeyMap;
    // Two actions on one key can only come from a hand-edited file: fall back to the defaults.
    if (new Set(Object.values(candidate)).size === ACTIONS.length) map = candidate;
  }
  return { muted: muted === true, keys: map, language: isLanguage(language) ? language : null };
}

/**
 * Gives `code` to `action`. If another action had that key, the two swap (so every action keeps a key).
 * Returns null for a reserved key.
 */
export function rebind(keys: KeyMap, action: Action, code: string): KeyMap | null {
  if (RESERVED_KEYS.has(code)) return null;
  const other = ACTIONS.find(a => a !== action && keys[a] === code);
  return { ...keys, [action]: code, ...(other ? { [other]: keys[action] } : {}) };
}

/** The key latch's table: the chosen keys plus the arrows. */
export function bindingsOf(keys: KeyMap): Bindings {
  const table: Record<string, number> = {};
  for (const [code, action] of Object.entries(ARROWS)) table[code] = ACTION_BUTTON[action];
  for (const action of ACTIONS) table[keys[action]] = ACTION_BUTTON[action];
  return table;
}

/** How a key is written on screen: KeyJ → J, Digit1 → 1, Space → Space, ShiftLeft → Shift. */
export function keyLabel(code: string): string {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  if (/^Numpad\d$/.test(code)) return `Num ${code.slice(6)}`;
  const named: Record<string, string> = {
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt',
    Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backslash: '\\', BracketLeft: '[', BracketRight: ']',
    Minus: '-', Equal: '=', Backquote: '`', CapsLock: 'Caps', Backspace: '⌫',
  };
  return named[code] ?? code;
}

/** The key names texts can mention ({keyPhysical}, {keyGuard}…; see i18n). */
export function keyNames(keys: KeyMap): Record<string, string> {
  const names: Record<string, string> = {};
  for (const action of ACTIONS) names[`key${action[0].toUpperCase()}${action.slice(1)}`] = keyLabel(keys[action]);
  return names;
}

export interface SettingsStore {
  load(): Settings;
  write(settings: Settings): void;
}

export function createSettingsStore(storage: Storage | null): SettingsStore {
  return {
    load: () => {
      try {
        return parseSettings(storage?.getItem(SETTINGS_KEY) ?? null);
      } catch {
        return DEFAULT_SETTINGS;
      }
    },
    write: settings => {
      try {
        storage?.setItem(SETTINGS_KEY, JSON.stringify(settings));
      } catch {
        // Storage full or blocked: the settings still apply until the page closes.
      }
    },
  };
}
