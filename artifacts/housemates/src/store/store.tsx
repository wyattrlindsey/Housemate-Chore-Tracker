import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import type { Chore, House, Housemate } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import {
  buildHouses,
  buildHousemates,
  choreInputToRow,
  chorePatchToRow,
  friendlyError,
  rowToChore,
  type ChoreInput,
  type ChoreRow,
  type HouseRow,
  type MemberRow,
  type ProfileRow,
} from '@/lib/mapping';

export type { ChoreInput } from '@/lib/mapping';

const CHORE_COLS = 'id, house_id, title, description, assignee_id, status, due_date, completed_at, created_at';
const prefKey = (userId: string) => `housemates.currentHouse.${userId}`;

interface HouseData {
  houseId: string;
  housemates: Housemate[];
  chores: Chore[];
}

interface Store {
  userId: string;
  houses: House[] | null;
  housesLoading: boolean;
  housesError: string | null;
  reloadHouses: () => Promise<void>;
  currentHouse: House | null;
  switchHouse: (id: string) => void;
  housemates: Housemate[];
  chores: Chore[];
  me: Housemate | undefined;
  dataLoading: boolean;
  dataError: string | null;
  reloadData: () => Promise<void>;
  saveError: string | null;
  dismissError: () => void;
  getHousemate: (id: string | null | undefined) => Housemate | undefined;
  addChore: (input: ChoreInput) => Promise<void>;
  updateChore: (id: string, input: Partial<ChoreInput>) => Promise<void>;
  deleteChore: (id: string) => Promise<void>;
  updateProfile: (patch: { displayName: string; avatarColor: string }) => Promise<void>;
  renameHouse: (name: string) => Promise<void>;
  createHouse: (name: string) => Promise<void>;
  joinHouse: (code: string) => Promise<void>;
  leaveHouse: () => Promise<void>;
  realtime: RealtimeState;
}

export type RealtimeState = 'connecting' | 'live' | 'reconnecting';

const Ctx = createContext<Store | null>(null);

function readPref(userId: string): string | null {
  try { return localStorage.getItem(prefKey(userId)); } catch { return null; }
}
function writePref(userId: string, id: string | null) {
  try {
    if (id) localStorage.setItem(prefKey(userId), id);
    else localStorage.removeItem(prefKey(userId));
  } catch { /* preference only */ }
}

function upsert(list: Chore[], chore: Chore): Chore[] {
  const i = list.findIndex((c) => c.id === chore.id);
  if (i === -1) return [...list, chore];
  const next = list.slice();
  next[i] = chore;
  return next;
}

export function StoreProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [houses, setHouses] = useState<House[] | null>(null);
  const [housesLoading, setHousesLoading] = useState(true);
  const [housesError, setHousesError] = useState<string | null>(null);
  const [preferred, setPreferred] = useState<string | null>(() => readPref(userId));
  const [data, setData] = useState<HouseData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [realtime, setRealtime] = useState<RealtimeState>('connecting');
  /** Bumped on every local chore write (mutation or realtime); older snapshots must not overwrite. */
  const choreRev = useRef(0);

  const currentHouse = houses?.length ? houses.find((h) => h.id === preferred) ?? houses[0] : null;
  const houseId = currentHouse?.id ?? null;
  const houseIdRef = useRef(houseId);
  houseIdRef.current = houseId;
  const housesReq = useRef(0);
  const dataReq = useRef(0);
  const choresReq = useRef(0);

  const fetchHouses = useCallback(async (): Promise<House[] | null> => {
    const token = ++housesReq.current;
    setHousesLoading(true);
    try {
      const mem = await supabase.from('house_members').select('house_id, role').eq('user_id', userId);
      if (mem.error) throw mem.error;
      const memberships = (mem.data ?? []) as Pick<MemberRow, 'house_id' | 'role'>[];
      let list: House[] = [];
      if (memberships.length) {
        const hs = await supabase.from('houses').select('id, name, invite_code, created_at').in('id', memberships.map((m) => m.house_id));
        if (hs.error) throw hs.error;
        list = buildHouses((hs.data ?? []) as HouseRow[], memberships);
      }
      if (token !== housesReq.current) return null;
      setHouses(list);
      setHousesError(null);
      return list;
    } catch (e) {
      if (token === housesReq.current) setHousesError(friendlyError(e, 'Could not load your houses.'));
      return null;
    } finally {
      if (token === housesReq.current) setHousesLoading(false);
    }
  }, [userId]);

  const reloadHouses = useCallback(async () => { await fetchHouses(); }, [fetchHouses]);

  const fetchHouseData = useCallback(async (id: string, silent: boolean) => {
    const token = ++dataReq.current;
    const choreToken = ++choresReq.current;
    const revAtStart = choreRev.current;
    if (!silent) setDataLoading(true);
    try {
      const [mRes, cRes] = await Promise.all([
        supabase.from('house_members').select('house_id, user_id, role, joined_at').eq('house_id', id),
        supabase.from('chores').select(CHORE_COLS).eq('house_id', id).order('created_at'),
      ]);
      if (mRes.error) throw mRes.error;
      if (cRes.error) throw cRes.error;
      const members = (mRes.data ?? []) as MemberRow[];
      let profiles: ProfileRow[] = [];
      if (members.length) {
        const pRes = await supabase.from('profiles').select('id, display_name, avatar_color').in('id', members.map((m) => m.user_id));
        if (pRes.error) throw pRes.error;
        profiles = (pRes.data ?? []) as ProfileRow[];
      }
      if (token !== dataReq.current || houseIdRef.current !== id) return;
      if (!members.some((m) => m.user_id === userId)) {
        // Membership vanished (left elsewhere): refresh the house list.
        void fetchHouses();
        return;
      }
      const housemates = buildHousemates(members, profiles);
      const fresh = ((cRes.data ?? []) as ChoreRow[]).map(rowToChore);
      const choresStale = choreToken !== choresReq.current || revAtStart !== choreRev.current;
      setData((d) => {
        if (choresStale && d && d.houseId === id) return { ...d, housemates };
        return { houseId: id, housemates, chores: fresh };
      });
      setDataError(null);
      // A newer write landed mid-flight: re-read chores instead of trusting this snapshot.
      if (choresStale) void refetchChoresRef.current(id);
    } catch (e) {
      if (token !== dataReq.current || houseIdRef.current !== id) return;
      const msg = friendlyError(e, 'Could not load this house.');
      if (silent) setSaveError(`Could not refresh: ${msg}`);
      else setDataError(msg);
    } finally {
      if (token === dataReq.current) setDataLoading(false);
    }
  }, [userId, fetchHouses]);

  const refetchChores = useCallback(async (id: string, attempt = 0): Promise<void> => {
    const token = ++choresReq.current;
    const revAtStart = choreRev.current;
    const res = await supabase.from('chores').select(CHORE_COLS).eq('house_id', id).order('created_at');
    if (res.error || token !== choresReq.current || houseIdRef.current !== id) return;
    if (revAtStart !== choreRev.current) {
      if (attempt < 3) return refetchChores(id, attempt + 1);
      return; // keep current (newer) local chores rather than an older snapshot
    }
    const chores = ((res.data ?? []) as ChoreRow[]).map(rowToChore);
    setData((d) => (d && d.houseId === id ? { ...d, chores } : d));
  }, []);
  const refetchChoresRef = useRef(refetchChores);
  refetchChoresRef.current = refetchChores;

  const reloadData = useCallback(async () => {
    if (houseIdRef.current) await fetchHouseData(houseIdRef.current, false);
  }, [fetchHouseData]);

  // Initial house list.
  useEffect(() => { void fetchHouses(); }, [fetchHouses]);

  // Load the current house whenever it changes; clear the previous house first.
  useEffect(() => {
    setData(null);
    setDataError(null);
    setSaveError(null);
    if (!houseId) return;
    void fetchHouseData(houseId, false);
  }, [houseId, fetchHouseData]);

  // Realtime: chores for the current house only. Unsubscribes on switch/logout.
  useEffect(() => {
    if (!houseId) return;
    let alive = true;
    setRealtime('connecting');
    let deleteTimer: number | undefined;
    const channel: RealtimeChannel = supabase
      .channel(`chores-${houseId}-${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chores', filter: `house_id=eq.${houseId}` }, (payload) => {
        if (!alive) return;
        const row = payload.new as ChoreRow;
        if (row.house_id !== houseId) return;
        choreRev.current++;
        setData((d) => {
          if (!d || d.houseId !== houseId) return d;
          if (row.assignee_id && !d.housemates.some((h) => h.id === row.assignee_id)) void fetchHouseData(houseId, true);
          return { ...d, chores: upsert(d.chores, rowToChore(row)) };
        });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chores', filter: `house_id=eq.${houseId}` }, (payload) => {
        if (!alive) return;
        const row = payload.new as ChoreRow;
        choreRev.current++;
        setData((d) => {
          if (!d || d.houseId !== houseId) return d;
          if (row.house_id !== houseId) return { ...d, chores: d.chores.filter((c) => c.id !== row.id) };
          if (row.assignee_id && !d.housemates.some((h) => h.id === row.assignee_id)) void fetchHouseData(houseId, true);
          return { ...d, chores: upsert(d.chores, rowToChore(row)) };
        });
      })
      // DELETE events cannot be filtered by house: drop the id if we have it, then refetch our list.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'chores' }, (payload) => {
        if (!alive) return;
        const id = (payload.old as Partial<ChoreRow>)?.id;
        if (id) choreRev.current++;
        if (id) setData((d) => (d && d.houseId === houseId ? { ...d, chores: d.chores.filter((c) => c.id !== id) } : d));
        window.clearTimeout(deleteTimer);
        deleteTimer = window.setTimeout(() => { if (alive) void refetchChores(houseId); }, 400);
      })
      .subscribe((status) => {
        if (!alive) return;
        if (status === 'SUBSCRIBED') {
          setRealtime('live');
          // Every (re)join, including the first, closes the gap since the last snapshot.
          void refetchChores(houseId);
          void fetchHouseData(houseId, true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setRealtime('reconnecting');
        }
      });
    return () => {
      alive = false;
      window.clearTimeout(deleteTimer);
      void supabase.removeChannel(channel);
    };
  }, [houseId, fetchHouseData, refetchChores]);

  // Refresh on focus / reconnect.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void fetchHouses();
      if (houseIdRef.current) void fetchHouseData(houseIdRef.current, true);
    };
    const offline = () => setRealtime('reconnecting');
    window.addEventListener('offline', offline);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('offline', offline);
    };
  }, [fetchHouses, fetchHouseData]);

  const switchHouse = useCallback((id: string) => {
    if (id === houseIdRef.current) return;
    dataReq.current++;
    choresReq.current++;
    setData(null);
    writePref(userId, id);
    setPreferred(id);
    queryClient.removeQueries({ queryKey: ['reminder-status'] });
  }, [userId, queryClient]);

  const liveData = data && data.houseId === houseId ? data : null;
  const housemates = liveData?.housemates ?? [];
  const chores = liveData?.chores ?? [];
  const dataRef = useRef(liveData);
  dataRef.current = liveData;

  const requireHouse = (): string => {
    const id = houseIdRef.current;
    if (!id) throw new Error('Choose a house first.');
    return id;
  };

  const applyChore = (row: ChoreRow) => {
    choreRev.current++;
    setData((d) => (d && d.houseId === row.house_id ? { ...d, chores: upsert(d.chores, rowToChore(row)) } : d));
  };

  const afterHouseChange = async (targetId: string | null) => {
    const list = await fetchHouses();
    if (!list) throw new Error('Done, but your houses could not be reloaded. Please refresh.');
    const next = targetId && list.some((h) => h.id === targetId) ? targetId : list[0]?.id ?? null;
    writePref(userId, next);
    setPreferred(next);
    queryClient.removeQueries({ queryKey: ['reminder-status'] });
  };

  const store: Store = {
    userId,
    houses,
    housesLoading,
    housesError,
    reloadHouses,
    currentHouse,
    switchHouse,
    housemates,
    chores,
    me: housemates.find((h) => h.id === userId),
    dataLoading: !!houseId && (dataLoading || !liveData) && !dataError,
    dataError,
    reloadData,
    saveError,
    dismissError: () => setSaveError(null),
    getHousemate: (id) => (id ? housemates.find((h) => h.id === id) : undefined),
    addChore: async (input) => {
      const house = requireHouse();
      const res = await supabase.from('chores').insert({ house_id: house, ...choreInputToRow(input, null) }).select(CHORE_COLS).single();
      if (res.error) throw new Error(friendlyError(res.error, 'The chore could not be added.'));
      applyChore(res.data as ChoreRow);
    },
    updateChore: async (id, patch) => {
      const house = requireHouse();
      const current = dataRef.current?.chores.find((c) => c.id === id);
      if (!current) throw new Error('This chore no longer exists. It may have been deleted.');
      const changes = chorePatchToRow(patch, current);
      if (Object.keys(changes).length === 0) return;
      const res = await supabase.from('chores').update(changes).eq('id', id).eq('house_id', house).select(CHORE_COLS).maybeSingle();
      if (res.error) throw new Error(friendlyError(res.error, 'Your changes could not be saved.'));
      if (!res.data) {
        void refetchChores(house);
        throw new Error('This chore no longer exists. It may have been deleted.');
      }
      applyChore(res.data as ChoreRow);
    },
    deleteChore: async (id) => {
      const house = requireHouse();
      const res = await supabase.from('chores').delete().eq('id', id).eq('house_id', house).select('id');
      if (res.error) throw new Error(friendlyError(res.error, 'The chore could not be deleted.'));
      if (!res.data?.length) {
        void refetchChores(house);
        throw new Error('The chore could not be deleted. It may already be gone.');
      }
      choreRev.current++;
      setData((d) => (d && d.houseId === house ? { ...d, chores: d.chores.filter((c) => c.id !== id) } : d));
    },
    updateProfile: async ({ displayName, avatarColor }) => {
      const res = await supabase.from('profiles').update({ display_name: displayName.trim(), avatar_color: avatarColor }).eq('id', userId).select('id, display_name, avatar_color').maybeSingle();
      if (res.error) throw new Error(friendlyError(res.error, 'Your profile could not be saved.'));
      if (!res.data) throw new Error('Your profile could not be saved.');
      const p = res.data as ProfileRow;
      setData((d) => d && {
        ...d,
        housemates: d.housemates.map((h) => (h.id === userId ? { ...h, name: p.display_name, avatarColor: p.avatar_color } : h)),
      });
    },
    renameHouse: async (name) => {
      const house = requireHouse();
      const res = await supabase.from('houses').update({ name: name.trim() }).eq('id', house).select('id, name').maybeSingle();
      if (res.error) throw new Error(friendlyError(res.error, 'The house name could not be saved.'));
      if (!res.data) throw new Error('Only the house owner can rename the house.');
      setHouses((list) => list && list.map((h) => (h.id === house ? { ...h, name: (res.data as { name: string }).name } : h)));
    },
    createHouse: async (name) => {
      const res = await supabase.rpc('create_house', { house_name: name.trim() });
      if (res.error) throw new Error(friendlyError(res.error, 'The house could not be created.'));
      const created = (Array.isArray(res.data) ? res.data[0] : res.data) as HouseRow | null;
      await afterHouseChange(created?.id ?? null);
    },
    joinHouse: async (code) => {
      const res = await supabase.rpc('join_house', { code: code.trim() });
      if (res.error) throw new Error(friendlyError(res.error, 'Could not join that house.'));
      const joined = (Array.isArray(res.data) ? res.data[0] : res.data) as HouseRow | null;
      await afterHouseChange(joined?.id ?? null);
    },
    realtime,
    leaveHouse: async () => {
      const house = requireHouse();
      const res = await supabase.rpc('leave_house', { h: house });
      if (res.error) {
        const msg = friendlyError(res.error, 'Could not leave the house.');
        if (/not a member/i.test(res.error.message ?? '')) {
          // Already gone: drop the stale house view and move on.
          dataReq.current++;
          setData(null);
          await afterHouseChange(null).catch(() => undefined);
          throw new Error(`${msg} Your house list has been refreshed.`);
        }
        throw new Error(msg);
      }
      dataReq.current++;
      setData(null);
      await afterHouseChange(null);
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
