import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { CalendarDays, Home, ListChecks, Plus, TriangleAlert, Users, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChoreEditor, useStore } from '@/store/store';

const NAV = [
  { href: '/', label: 'List', icon: ListChecks, id: 'list' },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays, id: 'calendar' },
  { href: '/housemates', label: 'Housemates', icon: Users, id: 'housemates' },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { saveError, dismissError, housemates } = useStore();
  const { openNew } = useChoreEditor();

  return (
    <div className="min-h-[100dvh] bg-background">
      <a href="#main" className="sr-only z-50 rounded-lg bg-card px-3 py-2 focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="link-home">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-soft">
              <Home className="h-[18px] w-[18px]" strokeWidth={2.25} aria-hidden="true" />
            </span>
            <span className="text-[17px] font-semibold tracking-tight">Housemates</span>
          </Link>
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
            disabled={housemates.length === 0}
            data-testid="button-add-chore"
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-soft transition-all duration-200 hover:-translate-y-px hover:shadow-lift active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
            <span>Add chore</span>
          </button>
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

      <main id="main" className="mx-auto max-w-6xl px-4 pb-32 pt-6 sm:px-6 sm:pt-10 md:pb-16">
        {children}
        <p className="mt-16 text-center text-xs text-muted-foreground" data-testid="text-storage-note">
          Your chores and housemates are stored only in this browser. They are not shared across devices or with other people.
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
