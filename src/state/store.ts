// Where the save lives: the browser's localStorage. Every access is guarded (private windows and blocked storage
// throw): the game still runs, it just can't remember anything.

import { parseSave, serializeSave, type LoadResult, type Save } from './save';

export const SAVE_KEY = 'poke-fight.save';
/** A save that could not be read is moved here instead of being lost. */
export const BROKEN_SAVE_KEY = 'poke-fight.save.broken';

export interface SaveStore {
  load(): LoadResult;
  write(save: Save): void;
  clear(): void;
}

/** `key`: where the save is kept (the endgame build keeps its own, state/endgame.ts). */
export function createSaveStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null, key = SAVE_KEY): SaveStore {
  const brokenKey = key === SAVE_KEY ? BROKEN_SAVE_KEY : `${key}.broken`;
  const safely = <T>(fn: () => T, fallback: T): T => {
    try {
      return storage ? fn() : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    load() {
      const raw = safely(() => storage!.getItem(key), null);
      const result = parseSave(raw);
      if (result.status === 'broken' && raw !== null) {
        safely(() => storage!.setItem(brokenKey, raw), undefined);
        safely(() => storage!.removeItem(key), undefined);
      }
      return result;
    },
    write(save) {
      safely(() => storage!.setItem(key, serializeSave(save)), undefined);
    },
    clear() {
      safely(() => storage!.removeItem(key), undefined);
    },
  };
}
