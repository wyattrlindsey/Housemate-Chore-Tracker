import { Check, Circle, CircleDashed } from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUSES, type ChoreStatus } from '@/lib/types';

export const statusStyle: Record<ChoreStatus, { pill: string; dot: string; icon: typeof Check }> = {
  'To-do': {
    pill: 'bg-[hsl(var(--todo-soft))] text-[hsl(var(--todo))]',
    dot: 'bg-[hsl(var(--todo))]',
    icon: Circle,
  },
  'In progress': {
    pill: 'bg-[hsl(var(--progress-soft))] text-[hsl(var(--progress))]',
    dot: 'bg-[hsl(var(--progress))]',
    icon: CircleDashed,
  },
  Completed: {
    pill: 'bg-[hsl(var(--done-soft))] text-[hsl(var(--done))]',
    dot: 'bg-[hsl(var(--done))]',
    icon: Check,
  },
};

export function StatusPill({ status, className }: { status: ChoreStatus; className?: string }) {
  const s = statusStyle[status];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-300',
        s.pill,
        className,
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
      {status}
    </span>
  );
}

/** Segmented control for quick status changes. Arrow keys move between options. */
export function StatusSegmented({
  value,
  onChange,
  label,
  idBase,
  size = 'sm',
}: {
  value: ChoreStatus;
  onChange: (s: ChoreStatus) => void;
  label: string;
  idBase: string;
  size?: 'sm' | 'md';
}) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + STATUSES.length) % STATUSES.length;
    onChange(STATUSES[n]);
    const el = document.getElementById(`${idBase}-${n}`);
    el?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex rounded-lg bg-muted p-0.5"
      data-testid={`segmented-status-${idBase}`}
    >
      {STATUSES.map((s, i) => {
        const active = s === value;
        return (
          <button
            key={s}
            id={`${idBase}-${i}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onClick={() => onChange(s)}
            data-testid={`button-status-${idBase}-${i}`}
            className={cn(
              'relative rounded-md font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
              active
                ? cn('bg-card shadow-soft', statusStyle[s].pill.split(' ')[1])
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className={cn('h-1.5 w-1.5 rounded-full transition-transform duration-300', statusStyle[s].dot, active ? 'scale-100' : 'scale-75 opacity-60')}
              />
              {s}
            </span>
          </button>
        );
      })}
    </div>
  );
}
