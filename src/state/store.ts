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

export function createSaveStore(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null): SaveStore {
  const safely = <T>(fn: () => T, fallback: T): T => {
    try {
      return storage ? fn() : fallback;
    } catch {
      return fallback;
    }
  };
  return {
    load() {
      const raw = safely(() => storage!.getItem(SAVE_KEY), null);
      const result = parseSave(raw);
      if (result.status === 'broken' && raw !== null) {
        safely(() => storage!.setItem(BROKEN_SAVE_KEY, raw), undefined);
        safely(() => storage!.removeItem(SAVE_KEY), undefined);
      }
      return result;
    },
    write(save) {
      safely(() => storage!.setItem(SAVE_KEY, serializeSave(save)), undefined);
    },
    clear() {
      safely(() => storage!.removeItem(SAVE_KEY), undefined);
    },
  };
}
