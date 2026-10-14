import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { appUrl, startedInRecovery, supabase } from '@/lib/supabase';
import { friendlyError } from '@/lib/mapping';

interface AuthCtx {
  session: Session | null;
  loading: boolean;
  recovery: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  finishRecovery: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

function fail(error: unknown, fallback: string): never {
  throw new Error(friendlyError(error, fallback));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovery, setRecovery] = useState(startedInRecovery);

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setLoading(false);
    }).catch(() => { if (alive) setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession((prev) => {
        if (prev?.user.id !== next?.user.id) queryClient.clear();
        return next;
      });
      setLoading(false);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [queryClient]);

  const value: AuthCtx = {
    session,
    loading,
    recovery,
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) fail(error, 'Could not sign in. Please try again.');
    },
    signUp: async (email, password, displayName) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { display_name: displayName.trim() }, emailRedirectTo: appUrl() },
      });
      if (error) fail(error, 'Could not create your account. Please try again.');
      return { needsConfirmation: !data.session };
    },
    signOut: async () => {
      const { error } = await supabase.auth.signOut();
      queryClient.clear();
      if (error) fail(error, 'Could not sign out cleanly. Please try again.');
    },
    sendReset: async (email) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: appUrl('reset-password') });
      if (error) fail(error, 'Could not send the reset email. Please try again.');
    },
    updatePassword: async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) fail(error, 'Could not update your password. Please try again.');
    },
    finishRecovery: () => {
      setRecovery(false);
      window.history.replaceState(null, '', appUrl());
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used inside AuthProvider');
  return c;
}
