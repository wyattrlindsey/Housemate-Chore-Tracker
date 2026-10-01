import { format } from 'date-fns';
import { CalendarCheck2, Check, Plus } from 'lucide-react';
import type { Chore } from '@/lib/types';
import { fromKey, todayKey } from '@/lib/dates';
import { useChoreEditor, useStore } from '@/store/store';
import { HmAvatar } from './avatar';
import { StatusPill } from './status';
import { cn } from '@/lib/utils';

function Row({ chore, completedMarker }: { chore: Chore; completedMarker?: boolean }) {
  const { getHousemate } = useStore();
  const { openEdit } = useChoreEditor();
  const hm = getHousemate(chore.assigneeId);
  const overdue = chore.status !== 'Completed' && chore.dueDate < todayKey();
  return (
    <li>
      <button
        type="button"
        onClick={() => openEdit(chore.id)}
        data-testid={`button-panel-chore-${chore.id}${completedMarker ? '-done' : ''}`}
        className={cn(
          'flex w-full items-start gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-200 hover:-translate-y-px hover:shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          overdue ? 'border-[hsl(var(--overdue)/0.35)]' : 'border-border',
        )}
      >
        <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: hm?.avatarColor }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm font-semibold', chore.status === 'Completed' && !completedMarker && 'text-muted-foreground line-through')}>
            {chore.title}
          </span>
          <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <HmAvatar name={hm?.name ?? '?'} color={hm?.avatarColor ?? '#94a3b8'} size="xs" className="ring-0" />
              {hm?.name}
            </span>
            {completedMarker ? (
              <span>was due {format(fromKey(chore.dueDate), 'MMM d')}</span>
            ) : (
              <>
                <StatusPill status={chore.status} />
                {overdue && <span className="font-medium text-[hsl(var(--overdue))]">Overdue</span>}
              </>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

export function DayPanel({ dateKey, due, completed }: { dateKey: string; due: Chore[]; completed: Chore[] }) {
  const { openNew } = useChoreEditor();
  const { housemates } = useStore();
  const d = fromKey(dateKey);
  return (
    <aside
      aria-label={`Chores for ${format(d, 'EEEE, MMMM d')}`}
      aria-live="polite"
      className="h-fit rounded-2xl border border-card-border bg-card p-5 shadow-soft lg:sticky lg:top-24"
      data-testid="panel-day"
    >
      <div key={dateKey} className="animate-rise">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{format(d, 'EEEE')}</p>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-semibold tracking-tight">{format(d, 'MMMM d')}</h2>
          <button
            type="button"
            onClick={() => openNew(dateKey)}
            disabled={housemates.length === 0}
            aria-label={`Add chore due ${format(d, 'MMMM d')}`}
            data-testid="button-panel-add"
            className="rounded-lg p-2 text-primary transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Due ({due.length})</h3>
        {due.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3 text-sm text-muted-foreground">
            <CalendarCheck2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Nothing due. A free day.
          </div>
        ) : (
          <ul className="space-y-2">{due.map((c) => <Row key={c.id} chore={c} />)}</ul>
        )}

        {completed.length > 0 && (
          <>
            <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(var(--done))]">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Completed this day ({completed.length})
            </h3>
            <ul className="space-y-2">{completed.map((c) => <Row key={c.id} chore={c} completedMarker />)}</ul>
          </>
        )}
      </div>
    </aside>
  );
}
