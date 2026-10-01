import { useState } from 'react';
import { Pencil, Plus, UserMinus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/store/store';
import type { Housemate } from '@/lib/types';
import { PageHeader } from '@/components/hm/page-header';
import { EmptyState } from '@/components/hm/empty-state';
import { HmAvatar } from '@/components/hm/avatar';
import { HousemateFormDialog, RemoveHousemateDialog } from '@/components/hm/housemate-dialogs';
import { isOverdue } from '@/components/hm/chore-card';
import { normalizeEmail } from '@/lib/email';

export default function HousematesPage() {
  const { housemates, chores } = useStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Housemate | undefined>();
  const [removing, setRemoving] = useState<Housemate | null>(null);

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  return (
    <div>
      <PageHeader title="Housemates" subtitle="Everyone who shares the load.">
        <Button onClick={openAdd} variant="outline" className="self-start rounded-xl bg-card sm:self-auto" data-testid="button-add-housemate">
          <Plus className="mr-1.5 h-4 w-4" /> Add housemate
        </Button>
      </PageHeader>

      {housemates.length === 0 ? (
        <EmptyState
          testId="empty-housemates"
          icon={Users}
          title="Who lives here?"
          body="Add the people you share your home with. Each gets a color so it's easy to see who is on what."
          action={<Button onClick={openAdd} className="rounded-xl" data-testid="button-empty-add-housemate"><Plus className="mr-1.5 h-4 w-4" /> Add your first housemate</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {housemates.map((h, i) => {
            const mine = chores.filter((c) => c.assigneeId === h.id);
            const open = mine.filter((c) => c.status !== 'Completed').length;
            const done = mine.length - open;
            const late = mine.filter(isOverdue).length;
            const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
            return (
              <li key={h.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-rise">
                <article className="group rounded-2xl border border-card-border bg-card p-5 shadow-soft transition-shadow duration-300 hover:shadow-lift" data-testid={`card-housemate-${h.id}`}>
                  <div className="flex items-center gap-3">
                    <HmAvatar name={h.name} color={h.avatarColor} size="lg" />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-base font-semibold" data-testid={`text-housemate-name-${h.id}`}>{h.name}</h2>
                      <p className="text-xs text-muted-foreground">
                        {mine.length === 0 ? 'No chores yet' : `${open} open · ${done} done`}
                        {late > 0 && <span className="font-medium text-[hsl(var(--overdue))]"> · {late} overdue</span>}
                      </p>
                       <p className="mt-1 break-all text-xs text-muted-foreground" data-testid={`text-housemate-email-${h.id}`}>
                         {normalizeEmail(h.email) ?? 'No email added'}
                       </p>
                    </div>
                  </div>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${h.name} completion`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full origin-left rounded-full transition-transform duration-700 ease-out" style={{ backgroundColor: h.avatarColor, transform: `scaleX(${pct / 100})` }} />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setEditing(h); setFormOpen(true); }}
                      className="rounded-lg"
                      data-testid={`button-edit-housemate-${h.id}`}
                      aria-label={`Edit ${h.name}`}
                    >
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setRemoving(h)}
                      className="rounded-lg text-muted-foreground hover:bg-[hsl(var(--overdue-soft))] hover:text-destructive"
                      data-testid={`button-remove-housemate-${h.id}`}
                      aria-label={`Remove ${h.name}`}
                    >
                      <UserMinus className="mr-1.5 h-3.5 w-3.5" /> Remove
                    </Button>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-10 rounded-2xl border border-border bg-accent/40 p-5 text-sm">
        <h2 className="font-semibold text-accent-foreground">Where your data lives</h2>
        <p className="mt-1 text-muted-foreground">
          Housemates saves your chores and housemates in this browser's local storage. There's no account, so your list won't sync to other devices. When you confirm sending reminders, only the recipients' names, email addresses, and unfinished chore details are sent to the reminder service. Clearing your browser data will erase your local list.
        </p>
      </div>

      <HousemateFormDialog open={formOpen} onOpenChange={setFormOpen} housemate={editing} />
      {removing && <RemoveHousemateDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)} housemate={removing} />}
    </div>
  );
}
