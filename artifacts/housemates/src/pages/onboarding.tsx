import { useState } from 'react';
import { Home, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { HouseForms } from '@/components/hm/housemate-dialogs';
import { useAuth } from '@/auth/auth';
import { toast } from '@/hooks/use-toast';

export default function OnboardingPage() {
  const { session, signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const name = (session?.user.user_metadata?.display_name as string | undefined)?.trim();

  const out = async () => {
    setLeaving(true);
    try { await signOut(); } catch (e) {
      toast({ variant: 'destructive', title: 'Sign out failed', description: e instanceof Error ? e.message : 'Please try again.' });
      setLeaving(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Home className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Housemates</span>
          </span>
          <Button variant="ghost" onClick={() => { void out(); }} disabled={leaving} className="rounded-xl" data-testid="button-signout">
            <LogOut className="mr-1.5 h-4 w-4" /> Sign out
          </Button>
        </div>
        <div className="animate-rise mt-14 text-center">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{name ? `Welcome, ${name}.` : 'Welcome.'}</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Chores live inside a house. Start one for your place, or join the house your housemates already set up.
          </p>
        </div>
        <div className="animate-rise mt-10" style={{ animationDelay: '80ms' }}>
          <HouseForms />
        </div>
      </div>
    </div>
  );
}
