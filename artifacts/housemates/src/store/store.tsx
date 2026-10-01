import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import type { AppData, Chore, ChoreStatus, Housemate } from '@/lib/types';
import { buildSeed, uid } from '@/lib/seed';
import { toast } from '@/hooks/use-toast';

const KEY = 'housemates.data.v1';

type LoadResult = { data: AppData; loadError: string | null };

function load(): LoadResult {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      const seed = buildSeed();
      try {
        localStorage.setItem(KEY, JSON.stringify(seed));
      } catch {
        return { data: seed, loadError: 'Sample data could not be saved in this browser. Changes may not persist.' };
      }
      return { data: seed, loadError: null };
    }
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      data: {
        version: 1,
        housemates: Array.isArray(parsed.housemates) ? parsed.housemates : [],
        chores: Array.isArray(parsed.chores) ? parsed.chores : [],
      },
      loadError: null,
    };
  } catch {
    return {
      data: { version: 1, housemates: [], chores: [] },
      loadError: 'Saved data could not be read. Storage may be blocked in this browser.',
    };
  }
}

export interface ChoreInput {
  title: string;
  description?: string;
  assigneeId: string;
  status: ChoreStatus;
  dueDate: string;
}

interface Store {
  housemates: Housemate[];
  chores: Chore[];
  saveError: string | null;
  dismissError: () => void;
  getHousemate: (id: string) => Housemate | undefined;
  addChore: (input: ChoreInput) => boolean;
  updateChore: (id: string, input: Partial<ChoreInput>) => boolean;
  deleteChore: (id: string) => boolean;
  addHousemate: (name: string, avatarColor: string) => boolean;
  updateHousemate: (id: string, patch: Partial<Omit<Housemate, 'id'>>) => boolean;
  removeHousemate: (id: string, reassignTo?: string) => boolean;
}

const Ctx = createContext<Store | null>(null);

function applyStatus(prev: Chore | null, next: ChoreStatus): string | null {
  if (next !== 'Completed') return null;
  if (prev && prev.status === 'Completed' && prev.completedAt) return prev.completedAt;
  return new Date().toISOString();
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = useRef<LoadResult | null>(null);
  if (!initial.current) initial.current = load();
  const [data, setData] = useState<AppData>(initial.current.data);
  const [saveError, setSaveError] = useState<string | null>(initial.current.loadError);
  const dataRef = useRef(data);
  dataRef.current = data;

  const commit = useCallback((next: AppData): boolean => {
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      const msg = 'Your change could not be saved. Browser storage may be full or disabled.';
      setSaveError(msg);
      toast({ variant: 'destructive', title: 'Not saved', description: msg });
      return false;
    }
    dataRef.current = next;
    setData(next);
    setSaveError(null);
    return true;
  }, []);

  const store: Store = {
    housemates: data.housemates,
    chores: data.chores,
    saveError,
    dismissError: () => setSaveError(null),
    getHousemate: (id) => data.housemates.find((h) => h.id === id),
    addChore: (input) => {
      const d = dataRef.current;
      const chore: Chore = {
        id: uid(),
        title: input.title.trim(),
        description: input.description?.trim() || undefined,
        assigneeId: input.assigneeId,
        status: input.status,
        dueDate: input.dueDate,
        createdAt: new Date().toISOString(),
        completedAt: applyStatus(null, input.status),
      };
      return commit({ ...d, chores: [...d.chores, chore] });
    },
    updateChore: (id, input) => {
      const d = dataRef.current;
      return commit({
        ...d,
        chores: d.chores.map((c) => {
          if (c.id !== id) return c;
          const status = input.status ?? c.status;
          return {
            ...c,
            ...input,
            title: (input.title ?? c.title).trim(),
            description: input.description !== undefined ? input.description.trim() || undefined : c.description,
            status,
            completedAt: applyStatus(c, status),
          };
        }),
      });
    },
    deleteChore: (id) => {
      const d = dataRef.current;
      return commit({ ...d, chores: d.chores.filter((c) => c.id !== id) });
    },
    addHousemate: (name, avatarColor) => {
      const d = dataRef.current;
      return commit({ ...d, housemates: [...d.housemates, { id: uid(), name: name.trim(), avatarColor }] });
    },
    updateHousemate: (id, patch) => {
      const d = dataRef.current;
      return commit({
        ...d,
        housemates: d.housemates.map((h) =>
          h.id === id ? { ...h, ...patch, name: (patch.name ?? h.name).trim() } : h,
        ),
      });
    },
    removeHousemate: (id, reassignTo) => {
      const d = dataRef.current;
      const assigned = d.chores.some((c) => c.assigneeId === id);
      if (assigned && (!reassignTo || reassignTo === id || !d.housemates.some((h) => h.id === reassignTo))) {
        return false;
      }
      return commit({
        ...d,
        housemates: d.housemates.filter((h) => h.id !== id),
        chores: assigned ? d.chores.map((c) => (c.assigneeId === id ? { ...c, assigneeId: reassignTo! } : c)) : d.chores,
      });
    },
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}

/** Shared chore editor state, so any screen can open the same modal. */
interface EditorCtx {
  openNew: (presetDate?: string) => void;
  openEdit: (id: string) => void;
}
export const ChoreEditorContext = createContext<EditorCtx | null>(null);
export function useChoreEditor(): EditorCtx {
  const c = useContext(ChoreEditorContext);
  if (!c) throw new Error('useChoreEditor must be inside provider');
  return c;
}
