import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { CalendarDays, Home, ListChecks, LogOut, Plus, RefreshCw, TriangleAlert, UserRound, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChoreEditor, useStore } from '@/store/store';
import { useAuth } from '@/auth/auth';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { HmAvatar } from './avatar';
import { ProfileDialog } from './housemate-dialogs';
import { toast } from '@/hooks/use-toast';

function HouseSwitcher() {
  const { houses, currentHouse, switchHouse } = useStore();
  if (!houses || !currentHouse) return null;
  if (houses.length < 2) {
    return <span className="hidden max-w-[12rem] truncate text-sm font-medium text-muted-foreground sm:block" data-testid="text-current-house">{currentHouse.name}</span>;
  }
  return (
    <Select value={currentHouse.id} onValueChange={switchHouse}>
      <SelectTrigger aria-label="Switch house" className="h-9 w-36 rounded-xl bg-card text-sm sm:w-44" data-testid="select-house">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {houses.map((h) => (
          <SelectItem key={h.id} value={h.id} data-testid={`option-house-${h.id}`}>{h.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function AccountMenu() {
  const { me } = useStore();
  const { session, signOut } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = me?.name ?? (session?.user.user_metadata?.display_name as string | undefined) ?? 'You';
  const out = async () => {
    setBusy(true);
    try { await signOut(); } catch (e) {
      toast({ variant: 'destructive', title: 'Sign out failed', description: e instanceof Error ? e.message : 'Please try again.' });
      setBusy(false);
    }
  };
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account" data-testid="button-account">
          <HmAvatar name={name} color={me?.avatarColor ?? '#94a3b8'} size="md" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 rounded-xl">
          <DropdownMenuLabel className="truncate" data-testid="text-account-name">{name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setProfileOpen(true)} data-testid="menu-edit-profile">
            <UserRound className="mr-2 h-4 w-4" /> Edit profile
          </DropdownMenuItem>
          <DropdownMenuItem disabled={busy} onSelect={() => { void out(); }} data-testid="menu-signout">
            <LogOut className="mr-2 h-4 w-4" /> {busy ? 'Signing out…' : 'Sign out'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}

function MainSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading house" data-testid="skeleton-house">
      <Skeleton className="h-9 w-48 rounded-xl" />
      <Skeleton className="mt-3 h-4 w-64 rounded-lg" />
      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
      </div>
    </div>
  );
}

const NAV = [
  { href: '/', label: 'List', icon: ListChecks, id: 'list' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, id: 'calendar' },
  { href: '/housemates', label: 'Housemates', icon: Users, id: 'housemates' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { saveError, dismissError, housemates, dataLoading, dataError, reloadData, realtime } = useStore();
  const [retrying, setRetrying] = useState(false);
  const retry = async () => { setRetrying(true); try { await reloadData(); } finally { setRetrying(false); } };
  const { openNew } = useChoreEditor();

  return (
    <div className="min-h-[100dvh] bg-background">
      <a href="#main" className="sr-only z-50 rounded-lg bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6 md:gap-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Home className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="hidden text-[17px] font-semibold tracking-tight sm:inline">Housemates</span>
          </Link>
          <HouseSwitcher />
          <nav aria-label="Main" className="hidden md:block">
            <ul className="flex items-center gap-1 rounded-xl bg-muted/70 p-1">
              {NAV.map((n) => {
                const active = loc === n.href;
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? 'page' : undefined}
                      data-testid={`link-nav-${n.id}`}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <n.icon className={cn('h-4 w-4', active && 'text-primary')} aria-hidden="true" />
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <button
            type="button"
            onClick={() => openNew()}
            disabled={housemates.length === 0 || dataLoading || !!dataError}
            data-testid="button-add-chore"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-200 hover:-translate-y-px hover:shadow-lift active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            <span className="hidden sm:inline">Add chore</span>
          </button>
          <AccountMenu />
        </div>
      </header>

      {saveError && (
        <div role="alert" className="mx-auto mt-4 max-w-6xl px-4 sm:px-6" data-testid="alert-save-error">
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-[hsl(var(--overdue-soft))] px-4 py-3 text-sm text-destructive">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">{saveError}</p>
            <button type="button" onClick={dismissError} aria-label="Dismiss" className="rounded p-0.5 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {realtime === 'reconnecting' && !dataError && (
        <div role="status" className="mx-auto mt-4 max-w-6xl px-4 sm:px-6" data-testid="status-realtime">
          <div className="flex items-center gap-3 rounded-xl border border-border bg-accent/50 px-4 py-3 text-sm text-accent-foreground">
            <RefreshCw className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
            <p className="flex-1">Live updates are paused while we reconnect. Changes from housemates will appear once the connection is back.</p>
          </div>
        </div>
      )}

      <main id="main" className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10 md:pb-16">
        {dataError ? (
          <div role="alert" className="animate-rise flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center" data-testid="error-house-data">
            <TriangleAlert className="h-6 w-6 text-destructive" aria-hidden="true" />
            <h2 className="mt-4 text-base font-semibold">This house didn't load</h2>
            <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{dataError}</p>
            <Button onClick={() => { void retry(); }} disabled={retrying} className="mt-6 rounded-xl" data-testid="button-retry-house">
              <RefreshCw className={cn('mr-1.5 h-4 w-4', retrying && 'animate-spin')} /> Try again
            </Button>
          </div>
        ) : dataLoading ? <MainSkeleton /> : children}
        <p className="mt-16 text-center text-xs text-muted-foreground" data-testid="text-storage-note">
          Chores sync live with everyone in this house.
        </p>
      </main>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-3">
          {NAV.map((n) => {
            const active = loc === n.href;
            return (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`link-tab-${n.id}`}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                    active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300', active ? 'bg-accent scale-100' : 'scale-90')}>
                    <n.icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  {n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
