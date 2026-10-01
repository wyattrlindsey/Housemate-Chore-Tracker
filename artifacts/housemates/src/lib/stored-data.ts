import type { AppData } from './types';

export const STORAGE_KEY = 'housemates.data.v1';

/** Keep version-one records intact: optional email needs no migration or reset. */
export function parseStoredData(raw: string): AppData {
  const parsed = JSON.parse(raw) as Partial<AppData>;
  return {
    version: 1,
    housemates: Array.isArray(parsed.housemates) ? parsed.housemates : [],
    chores: Array.isArray(parsed.chores) ? parsed.chores : [],
  };
}