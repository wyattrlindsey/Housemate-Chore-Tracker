import { useState, type ReactNode } from 'react';
import { Home, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/auth/auth';
import { supabaseConfigured } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'forgot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AuthFrame({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-10">
      <div className="animate-rise w-full max-w-md">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
            <Home className="h-5 w-5" strokeWidth={2.25} aria-hidden="true" />
          </span>
          <span className="text-xl font-semibold tracking-tight">Housemates</span>
        </div>
        <div className="rounded-2xl border border-card-border bg-card p-6 shadow-soft sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          {!supabaseConfigured && (
            <p role="alert" className="mt-4 rounded-xl bg-[hsl(var(--overdue-soft))] p-3 text-sm text-destructive">
              The app is not connected to its database yet. Sign-in will not work until it is configured.
            </p>
          )}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Alert({ text }: { text: string | null }) {
  if (!text) return null;
  return <p role="alert" className="rounded-xl bg-[hsl(var(--overdue-soft))] p-3 text-sm text-destructive" data-testid="error-auth">{text}</p>;
}

export default function AuthPage() {
  const { signIn, signUp, sendReset } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<'confirm' | 'reset' | null>(null);

  const go = (m: Mode) => { setMode(m); setError(null); setSent(null); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!EMAIL_RE.test(email.trim())) return setError('Enter a valid email address.');
    if (mode === 'signup' && !name.trim()) return setError('Tell your housemates what to call you.');
    if (mode === 'signup' && name.trim().length > 40) return setError('Keep your name under 40 characters.');
    if (mode !== 'forgot' && password.length < (mode === 'signup' ? 6 : 1)) {
      return setError(mode === 'signup' ? 'Use at least 6 characters for your password.' : 'Enter your password.');
    }
    setPending(true);
    setError(null);
    try {
      if (mode === 'signin') await signIn(email, password);
      else if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email, password, name);
        if (needsConfirmation) setSent('confirm');
      } else {
        await sendReset(email);
        setSent('reset');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <AuthFrame title="Check your inbox" subtitle={sent === 'confirm' ? 'One more step before you move in.' : 'A reset link is on its way.'}>
        <div className="flex items-start gap-3 rounded-xl bg-accent/50 p-4 text-sm" data-testid="text-auth-sent">
          <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            {sent === 'confirm'
              ? `We sent a confirmation link to ${email.trim()}. Open it, then sign in here.`
              : `If an account exists for ${email.trim()}, you'll get a link to choose a new password.`}
          </p>
        </div>
        <Button variant="outline" onClick={() => go('signin')} className="mt-5 w-full rounded-xl" data-testid="button-back-signin">Back to sign in</Button>
      </AuthFrame>
    );
  }

  const copy = {
    signin: { title: 'Welcome home', subtitle: 'Sign in to see what needs doing.', cta: 'Sign in', busy: 'Signing in…' },
    signup: { title: 'Create your account', subtitle: 'Then start a house or join one with an invite code.', cta: 'Create account', busy: 'Creating account…' },
    forgot: { title: 'Reset your password', subtitle: "Enter your email and we'll send you a reset link.", cta: 'Send reset link', busy: 'Sending…' },
  }[mode];

  return (
    <AuthFrame title={copy.title} subtitle={copy.subtitle}>
      <form onSubmit={(e) => { void submit(e); }} noValidate className="space-y-4" data-testid={`form-${mode}`}>
        <fieldset disabled={pending} className="space-y-4">
          {mode === 'signup' && (
            <div className="space-y-1.5">
              <Label htmlFor="auth-name">Your name</Label>
              <Input id="auth-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="e.g. Priya" data-testid="input-display-name" className="h-11 rounded-xl" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="input-email" className="h-11 rounded-xl" />
          </div>
          {mode !== 'forgot' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="auth-password">Password</Label>
                {mode === 'signin' && (
                  <button type="button" onClick={() => go('forgot')} className="text-xs font-medium text-primary hover:underline" data-testid="link-forgot-password">
                    Forgot password?
                  </button>
                )}
              </div>
              <Input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} data-testid="input-password" className="h-11 rounded-xl" />
            </div>
          )}
          <Alert text={error} />
          <Button type="submit" className="h-11 w-full rounded-xl" data-testid="button-auth-submit">
            {pending ? copy.busy : copy.cta}
          </Button>
        </fieldset>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === 'signin' ? (
          <>New here? <button type="button" onClick={() => go('signup')} className="font-medium text-primary hover:underline" data-testid="link-signup">Create an account</button></>
        ) : (
          <>Already have an account? <button type="button" onClick={() => go('signin')} className="font-medium text-primary hover:underline" data-testid="link-signin">Sign in</button></>
        )}
      </p>
    </AuthFrame>
  );
}

export function ResetPasswordPage() {
  const { session, updatePassword, finishRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!session) {
    return (
      <AuthFrame title="Reset link expired" subtitle="This password reset link is no longer valid.">
        <p className="text-sm text-muted-foreground">Request a new link from the sign-in screen and open it on this device.</p>
        <Button onClick={finishRecovery} className="mt-5 w-full rounded-xl" data-testid="button-recovery-back">Back to sign in</Button>
      </AuthFrame>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (password.length < 6) return setError('Use at least 6 characters for your password.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setPending(true);
    setError(null);
    try {
      await updatePassword(password);
      finishRecovery();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthFrame title="Choose a new password" subtitle={`For ${session.user.email ?? 'your account'}.`}>
      <form onSubmit={(e) => { void submit(e); }} noValidate className="space-y-4" data-testid="form-reset-password">
        <fieldset disabled={pending} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" data-testid="input-new-password" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" data-testid="input-confirm-password" className="h-11 rounded-xl" />
          </div>
          <Alert text={error} />
          <Button type="submit" className="h-11 w-full rounded-xl" data-testid="button-update-password">
            {pending ? 'Saving…' : 'Save new password'}
          </Button>
        </fieldset>
      </form>
    </AuthFrame>
  );
}
