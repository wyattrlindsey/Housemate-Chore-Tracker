import { useState } from 'react';
import { AlertCircle, CalendarDays, CheckCircle2, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import type { Chore, ChoreStatus } from '@/lib/types';
import { friendlyDate, isoToLocalKey, todayKey, fromKey } from '@/lib/dates';
import { useChoreEditor, useStore } from '@/store/store';
import { HmAvatar } from './avatar';
import { StatusPill, StatusSegmented } from './status';
import { DeleteChoreDialog } from './delete-chore-dialog';
import { toast } from '@/hooks/use-toast';

export function isOverdue(c: Chore): boolean {
  return c.status !== 'Completed' && c.dueDate < todayKey();
}

export function ChoreCard({ chore, index = 0 }: { chore: Chore; index?: number }) {
  const { getHousemate, updateChore } = useStore();
  const { openEdit } = useChoreEditor();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pulse, setPulse] = useState(0);
  const hm = getHousemate(chore.assigneeId);
  const overdue = isOverdue(chore);
  const done = chore.status === 'Completed';
  const completedKey = isoToLocalKey(chore.completedAt);

  const setStatus = (s: ChoreStatus) => {
    if (s === chore.status) return;
    if (updateChore(chore.id, { status: s })) {
      setPulse((p) => p + 1);
      if (s === 'Completed') toast({ title: 'Nicely done', description: `"${chore.title}" is marked complete.` });
    }
  };

  return (
    <article
      data-testid={`card-chore-${chore.id}`}
      style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
      className={cn(
        'animate-rise group relative overflow-hidden rounded-2xl border bg-card p-4 shadow-soft transition-all duration-300 hover:shadow-lift sm:p-5',
        overdue ? 'border-[hsl(var(--overdue)/0.35)]' : 'border-card-border',
      )}
    >
      {overdue && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[hsl(var(--overdue))]" />}
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={cn(
                'text-[15px] font-semibold leading-snug transition-colors duration-300',
                done && 'text-muted-foreground line-through decoration-muted-foreground/40',
              )}
              data-testid={`text-chore-title-${chore.id}`}
            >
              {chore.title}
            </h3>
            <span key={pulse} className={pulse ? 'animate-pop' : undefined}>
              <StatusPill status={chore.status} />
            </span>
          </div>
          {chore.description && (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{chore.description}</p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-2" data-testid={`text-chore-assignee-${chore.id}`}>
              <HmAvatar name={hm?.name ?? '?'} color={hm?.avatarColor ?? '#94a3b8'} size="sm" />
              <span className="font-medium">{hm?.name ?? 'Unassigned'}</span>
            </span>
            <span
              className={cn(
                'inline-flex items-center gap-1.5',
                overdue ? 'font-medium text-[hsl(var(--overdue))]' : 'text-muted-foreground',
              )}
              data-testid={`text-chore-due-${chore.id}`}
            >
              {overdue ? <AlertCircle className="h-4 w-4" aria-hidden="true" /> : <CalendarDays className="h-4 w-4" aria-hidden="true" />}
              <span>
                {overdue ? 'Overdue · ' : 'Due '}
                <time dateTime={chore.dueDate}>{friendlyDate(chore.dueDate)}</time>
              </span>
            </span>
            {done && completedKey && (
              <span className="inline-flex items-center gap-1.5 text-[hsl(var(--done))]">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                Done {format(fromKey(completedKey), 'MMM d')}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <button
            type="button"
            onClick={() => openEdit(chore.id)}
            aria-label={`Edit ${chore.title}`}
            data-testid={`button-edit-chore-${chore.id}`}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={`Delete ${chore.title}`}
            data-testid={`button-delete-chore-${chore.id}`}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-[hsl(var(--overdue-soft))] hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <StatusSegmented
          value={chore.status}
          onChange={setStatus}
          label={`Status of ${chore.title}`}
          idBase={`st-${chore.id}`}
        />
      </div>
      <DeleteChoreDialog chore={chore} open={confirmOpen} onOpenChange={setConfirmOpen} />
    </article>
  );
}
