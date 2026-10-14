import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store/store';
import type { Chore } from '@/lib/types';
import { fromKey, isoToLocalKey, toKey, todayKey } from '@/lib/dates';
import { PageHeader } from '@/components/hm/page-header';
import { DayPanel } from '@/components/hm/day-panel';
import { CalendarLegend } from '@/components/hm/calendar-legend';
import { cn } from '@/lib/utils';

type View = 'month' | 'week';

export default function CalendarPage() {
  const { chores, getHousemate } = useStore();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string>(todayKey());
  const today = todayKey();

  const days = useMemo(() => {
    if (view === 'week') {
      const s = startOfWeek(cursor);
      return eachDayOfInterval({ start: s, end: endOfWeek(cursor) });
    }
    return eachDayOfInterval({ start: startOfWeek(startOfMonth(cursor)), end: endOfWeek(endOfMonth(cursor)) });
  }, [cursor, view]);

  const { dueMap, doneMap } = useMemo(() => {
    const due = new Map<string, Chore[]>();
    const done = new Map<string, Chore[]>();
    for (const c of chores) {
      if (c.dueDate) (due.get(c.dueDate) ?? due.set(c.dueDate, []).get(c.dueDate)!).push(c);
      const k = c.status === 'Completed' ? isoToLocalKey(c.completedAt) : null;
      if (k) (done.get(k) ?? done.set(k, []).get(k)!).push(c);
    }
    return { dueMap: due, doneMap: done };
  }, [chores]);

  const step = (dir: 1 | -1) => setCursor((c) => (view === 'month' ? addMonths(c, dir) : addWeeks(c, dir)));
  const goToday = () => {
    setCursor(new Date());
    setSelected(today);
  };

  const label =
    view === 'month'
      ? format(cursor, 'MMMM yyyy')
      : `${format(startOfWeek(cursor), 'MMM d')} – ${format(endOfWeek(cursor), 'MMM d, yyyy')}`;

  const onGridKey = (e: React.KeyboardEvent, key: string) => {
    const map: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (!(e.key in map)) return;
    e.preventDefault();
    const next = toKey(addDays(fromKey(key), map[e.key]));
    setSelected(next);
    const nd = fromKey(next);
    if (!days.some((d) => toKey(d) === next)) setCursor(nd);
    requestAnimationFrame(() => document.getElementById(`day-${next}`)?.focus());
  };

  const maxChips = view === 'week' ? 8 : 2;

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Who is doing what, and when.">
        <div role="group" aria-label="Calendar view" className="inline-flex self-start rounded-xl bg-muted p-1 sm:self-auto">
          {(['month', 'week'] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              data-testid={`button-view-${v}`}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                view === v ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section aria-label="Calendar" className="rounded-2xl border border-card-border bg-card p-3 shadow-soft sm:p-5">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="flex-1 text-lg font-semibold tracking-tight" aria-live="polite" data-testid="text-calendar-label">{label}</h2>
            <Button variant="outline" size="sm" onClick={goToday} className="rounded-lg" data-testid="button-today">Today</Button>
            <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label={`Previous ${view}`} className="h-8 w-8 rounded-lg" data-testid="button-prev">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label={`Next ${view}`} className="h-8 w-8 rounded-lg" data-testid="button-next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 pb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground" aria-hidden="true">
            {days.slice(0, 7).map((d) => (
              <div key={d.toISOString()}>
                <span className="sm:hidden">{format(d, 'EEEEE')}</span>
                <span className="hidden sm:inline">{format(d, 'EEE')}</span>
              </div>
            ))}
          </div>

          <div key={`${view}-${label}`} className="animate-rise grid grid-cols-7 gap-1 sm:gap-1.5" role="grid" aria-label={label}>
            {days.map((d) => {
              const key = toKey(d);
              const due = dueMap.get(key) ?? [];
              const done = doneMap.get(key) ?? [];
              const inMonth = view === 'week' || isSameMonth(d, cursor);
              const isToday = key === today;
              const isSel = key === selected;
              const desc = `${format(d, 'EEEE, MMMM d')}. ${due.length} due${done.length ? `, ${done.length} completed` : ''}.`;
              return (
                <button
                  key={key}
                  id={`day-${key}`}
                  type="button"
                  role="gridcell"
                  aria-selected={isSel}
                  aria-label={desc}
                  tabIndex={isSel ? 0 : -1}
                  onClick={() => setSelected(key)}
                  onKeyDown={(e) => onGridKey(e, key)}
                  data-testid={`day-${key}`}
                  className={cn(
                    'group relative flex flex-col items-stretch rounded-xl border p-1 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-1.5',
                    view === 'week' ? 'min-h-[180px] sm:min-h-[320px]' : 'min-h-[58px] sm:min-h-[104px]',
                    isSel ? 'border-primary/50 bg-accent/50' : 'border-transparent hover:bg-muted/60',
                    !inMonth && 'opacity-45',
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span
                      className={cn(
                        'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        isToday ? 'bg-primary text-primary-foreground' : 'text-foreground',
                      )}
                    >
                      {format(d, 'd')}
                    </span>
                    {done.length > 0 && (
                      <span className="flex -space-x-1" aria-hidden="true">
                        {done.slice(0, 3).map((c) => (
                          <span
                            key={c.id}
                            title={`${c.title} completed`}
                            className="flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-card"
                            style={{ backgroundColor: getHousemate(c.assigneeId)?.avatarColor ?? '#94a3b8' }}
                          >
                            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  {/* mobile month: dots */}
                  {view === 'month' && due.length > 0 && (
                    <span className="mt-auto flex flex-wrap gap-0.5 px-0.5 pb-0.5 sm:hidden" aria-hidden="true">
                      {due.slice(0, 4).map((c) => (
                        <span
                          key={c.id}
                          className={cn('h-1.5 w-1.5 rounded-full', c.status === 'Completed' && 'opacity-40')}
                          style={{ backgroundColor: getHousemate(c.assigneeId)?.avatarColor ?? '#94a3b8' }}
                        />
                      ))}
                    </span>
                  )}
                  <span className={cn('mt-1 flex-col gap-1', view === 'month' ? 'hidden sm:flex' : 'flex')} aria-hidden="true">
                    {due.slice(0, maxChips).map((c) => {
                      const color = getHousemate(c.assigneeId)?.avatarColor ?? '#94a3b8';
                      const doneC = c.status === 'Completed';
                      const over = !doneC && !!c.dueDate && c.dueDate < today;
                      return (
                        <span
                          key={c.id}
                          className={cn(
                            'truncate rounded-md border-l-[3px] px-1.5 py-0.5 text-[11px] font-medium leading-tight',
                            doneC && 'line-through opacity-55',
                            over && 'ring-1 ring-[hsl(var(--overdue)/0.5)]',
                          )}
                          style={{ borderLeftColor: color, backgroundColor: `${color}1A`, color }}
                        >
                          {c.title}
                        </span>
                      );
                    })}
                    {due.length > maxChips && (
                      <span className="px-1.5 text-[11px] font-medium text-muted-foreground">+{due.length - maxChips} more</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <CalendarLegend />
        </section>

        <DayPanel dateKey={selected} due={dueMap.get(selected) ?? []} completed={doneMap.get(selected) ?? []} />
      </div>
    </div>
  );
}
