import { createClient } from '@supabase/supabase-js';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export const supabaseConfigured = !!url && !!key;

/** Captured before the client consumes the URL tokens. */
export const startedInRecovery =
  typeof window !== 'undefined' &&
  (/type=recovery/.test(window.location.hash) || /type=recovery/.test(window.location.search) || /\/reset-password\/?$/.test(window.location.pathname));

export const supabase = createClient(url ?? 'http://localhost:54321', key ?? 'missing-key', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

// Generated API hooks send the current Supabase access token as a Bearer header.
setAuthTokenGetter(async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
});

export function appUrl(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${window.location.origin}${base}/${path.replace(/^\//, '')}`;
}
