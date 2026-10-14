import { useMemo, useState } from 'react';
import { ArrowDownWideNarrow, ArrowUpNarrowWide, ClipboardList, Plus, SearchX } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useChoreEditor, useStore } from '@/store/store';
import { STATUSES } from '@/lib/types';
import { ChoreCard, isOverdue } from '@/components/hm/chore-card';
import { EmptyState } from '@/components/hm/empty-state';
import { PageHeader } from '@/components/hm/page-header';
import { HmAvatar } from '@/components/hm/avatar';
import { cn } from '@/lib/utils';
import { compareChores } from '@/lib/mapping';
import { ReminderControl } from '@/components/hm/reminder-control';

export default function ListPage() {
  const { chores, housemates } = useStore();
  const { openNew } = useChoreEditor();
  const [status, setStatus] = useState<string>('all');
  const [who, setWho] = useState<string>('all');
  const [asc, setAsc] = useState(true);

  const filtered = useMemo(() => {
    const list = chores.filter(
      (c) => (status === 'all' || c.status === status) && (who === 'all' || (who === 'none' ? !c.assigneeId : c.assigneeId === who)),
    );
    return list.sort((a, b) => compareChores(a, b, asc));
  }, [chores, status, who, asc]);

  const overdueCount = chores.filter(isOverdue).length;
  const openCount = chores.filter((c) => c.status !== 'Completed').length;
  const hasFilters = status !== 'all' || who !== 'all';

  return (
    <div>
      <PageHeader
        title="Chores"
        subtitle={
          chores.length === 0 ? (
            'Nothing on the list yet.'
          ) : (
            <span data-testid="text-summary">
              {openCount} open
              {overdueCount > 0 && (
                <>
                  {' · '}
                  <span className="font-medium text-[hsl(var(--overdue))]">{overdueCount} overdue</span>
                </>
              )}
              {' · '}
              {chores.length - openCount} done
            </span>
          )
        }
      >
        <ReminderControl />
      </PageHeader>

      {chores.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
            {['all', ...STATUSES].map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={status === s}
                onClick={() => setStatus(s)}
                data-testid={`filter-status-${s.replace(/\s/g, '-').toLowerCase()}`}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  status === s
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-muted-foreground hover:border-input hover:text-foreground',
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="filter-who" className="sr-only">Filter by housemate</label>
            <Select value={who} onValueChange={setWho}>
              <SelectTrigger id="filter-who" className="h-9 w-full rounded-xl bg-card sm:w-48" data-testid="select-filter-housemate">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="none">Unassigned</SelectItem>
                {housemates.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-2">
                      <HmAvatar name={h.name} color={h.avatarColor} size="xs" className="ring-0" />
                      {h.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => setAsc((a) => !a)}
              className="h-9 shrink-0 rounded-xl bg-card"
              data-testid="button-sort-due"
              aria-label={`Sort by due date, ${asc ? 'soonest first' : 'latest first'}. Activate to reverse.`}
            >
              {asc ? <ArrowUpNarrowWide className="mr-1.5 h-4 w-4" /> : <ArrowDownWideNarrow className="mr-1.5 h-4 w-4" />}
              {asc ? 'Soonest' : 'Latest'}
            </Button>
          </div>
        </div>
      )}

      {chores.length === 0 ? (
        <EmptyState
          testId="empty-chores"
          icon={ClipboardList}
          title="A clean slate"
          body={
            housemates.length === 0
              ? 'Add your housemates first, then share out the jobs that keep the place running.'
              : 'Add the first chore and decide who takes it on. Small jobs, shared fairly.'
          }
          action={
            housemates.length > 0 && (
              <Button onClick={() => openNew()} className="rounded-xl" data-testid="button-empty-add">
                <Plus className="mr-1.5 h-4 w-4" /> Add a chore
              </Button>
            )
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          testId="empty-filtered"
          icon={SearchX}
          title="No chores match"
          body="Nothing fits these filters right now. Try a different status or housemate."
          action={
            hasFilters && (
              <Button variant="outline" className="rounded-xl" onClick={() => { setStatus('all'); setWho('all'); }} data-testid="button-clear-filters">
                Clear filters
              </Button>
            )
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2" aria-label="Chores">
          {filtered.map((c, i) => (
            <li key={c.id}>
              <ChoreCard chore={c} index={i} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
