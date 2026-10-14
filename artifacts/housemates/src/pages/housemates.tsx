import { useEffect, useState } from 'react';
import { Check, Copy, Crown, DoorOpen, Home, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useStore } from '@/store/store';
import { PageHeader } from '@/components/hm/page-header';
import { HmAvatar } from '@/components/hm/avatar';
import { AddHouseDialog, LeaveHouseDialog, ProfileDialog } from '@/components/hm/housemate-dialogs';
import { isOverdue } from '@/components/hm/chore-card';
import { toast } from '@/hooks/use-toast';

function HouseSettings() {
  const { currentHouse, renameHouse } = useStore();
  const [name, setName] = useState(currentHouse?.name ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const isOwner = currentHouse?.role === 'owner';

  useEffect(() => { setName(currentHouse?.name ?? ''); setError(null); }, [currentHouse?.id, currentHouse?.name]);

  if (!currentHouse) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(currentHouse.inviteCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
      toast({ title: 'Invite code copied' });
    } catch {
      toast({ variant: 'destructive', title: 'Could not copy', description: `Your browser blocked the clipboard. The code is ${currentHouse.inviteCode}.` });
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Give the house a name.');
    if (n.length > 60) return setError('Keep the name under 60 characters.');
    if (n === currentHouse.name || pending) return;
    setPending(true);
    setError(null);
    try {
      await renameHouse(n);
      toast({ title: 'House renamed', description: n });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The house name could not be saved.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="mt-10 rounded-2xl border border-card-border bg-card p-5 shadow-soft sm:p-6" aria-labelledby="house-settings" data-testid="section-house-settings">
      <h2 id="house-settings" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Home className="h-[18px] w-[18px] text-primary" aria-hidden="true" /> House settings
      </h2>
      <div className="mt-5 grid gap-6 md:grid-cols-2">
        <form onSubmit={(e) => { void save(e); }} noValidate className="space-y-1.5">
          <Label htmlFor="settings-house-name">House name</Label>
          <div className="flex gap-2">
            <Input
              id="settings-house-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwner || pending}
              data-testid="input-settings-house-name"
              className="h-11 rounded-xl"
            />
            {isOwner && (
              <Button type="submit" disabled={pending || name.trim() === currentHouse.name} className="h-11 rounded-xl" data-testid="button-save-house-name">
                {pending ? 'Saving…' : 'Save'}
              </Button>
            )}
          </div>
          {!isOwner && <p className="text-xs text-muted-foreground">Only the house owner can rename the house.</p>}
          {error && <p role="alert" className="text-sm text-destructive" data-testid="error-house-name">{error}</p>}
        </form>
        <div className="space-y-1.5">
          <span className="text-sm font-medium">Invite code</span>
          <div className="flex gap-2">
            <code className="flex h-11 flex-1 items-center rounded-xl bg-muted/70 px-4 font-mono text-base tracking-[0.3em]" data-testid="text-invite-code">{currentHouse.inviteCode}</code>
            <Button type="button" variant="outline" onClick={() => { void copy(); }} className="h-11 rounded-xl bg-card" data-testid="button-copy-invite">
              {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Anyone with this code can join and see the house's chores.</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2 border-t border-border pt-5">
        <Button variant="outline" onClick={() => setAddOpen(true)} className="rounded-xl bg-card" data-testid="button-add-house">
          <Plus className="mr-1.5 h-4 w-4" /> Create or join another house
        </Button>
        <Button variant="ghost" onClick={() => setLeaveOpen(true)} className="rounded-xl text-destructive hover:bg-[hsl(var(--overdue-soft))] hover:text-destructive sm:ml-auto" data-testid="button-leave-house">
          <DoorOpen className="mr-1.5 h-4 w-4" /> Leave house
        </Button>
      </div>
      <AddHouseDialog open={addOpen} onOpenChange={setAddOpen} />
      <LeaveHouseDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
    </section>
  );
}

export default function HousematesPage() {
  const { housemates, chores, userId } = useStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const unassigned = chores.filter((c) => !c.assigneeId && c.status !== 'Completed').length;

  return (
    <div>
      <PageHeader title="Housemates" subtitle="Everyone who shares the load.">
        <Button onClick={() => setProfileOpen(true)} variant="outline" className="self-start rounded-xl bg-card sm:self-auto" data-testid="button-edit-profile">
          <Pencil className="mr-1.5 h-4 w-4" /> Edit my profile
        </Button>
      </PageHeader>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Roster">
        {housemates.map((h, i) => {
          const mine = chores.filter((c) => c.assigneeId === h.id);
          const open = mine.filter((c) => c.status !== 'Completed').length;
          const done = mine.length - open;
          const late = mine.filter(isOverdue).length;
          const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
          const isMe = h.id === userId;
          return (
            <li key={h.id} style={{ animationDelay: `${i * 40}ms` }} className="animate-rise">
              <article className="group rounded-2xl border border-card-border bg-card p-5 shadow-soft transition-shadow duration-300 hover:shadow-lift" data-testid={`card-housemate-${h.id}`}>
                <div className="flex items-center gap-3">
                  <HmAvatar name={h.name} color={h.avatarColor} size="lg" />
                  <div className="min-w-0 flex-1">
                    <h2 className="flex items-center gap-1.5 truncate text-base font-semibold" data-testid={`text-housemate-name-${h.id}`}>
                      <span className="truncate">{h.name}</span>
                      {isMe && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">You</span>}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {mine.length === 0 ? 'No chores yet' : `${open} open · ${done} done`}
                      {late > 0 && <span className="font-medium text-[hsl(var(--overdue))]"> · {late} overdue</span>}
                    </p>
                    {h.role === 'owner' && (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground" data-testid={`text-housemate-role-${h.id}`}>
                        <Crown className="h-3 w-3" aria-hidden="true" /> House owner
                      </p>
                    )}
                  </div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={`${h.name} completion`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full origin-left rounded-full transition-transform duration-700 ease-out" style={{ backgroundColor: h.avatarColor, transform: `scaleX(${pct / 100})` }} />
                </div>
                {isMe && (
                  <div className="mt-4 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setProfileOpen(true)} className="rounded-lg" data-testid={`button-edit-housemate-${h.id}`} aria-label="Edit your profile">
                      <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>

      {unassigned > 0 && (
        <p className="mt-4 text-sm text-muted-foreground" data-testid="text-unassigned-count">
          {unassigned} unfinished chore{unassigned === 1 ? ' is' : 's are'} unassigned. Open {unassigned === 1 ? 'it' : 'one'} from the list to pick someone.
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-accent/40 p-5 text-sm">
        <h2 className="font-semibold text-accent-foreground">Growing the household</h2>
        <p className="mt-1 text-muted-foreground">
          Housemates join on their own: share the invite code below and they sign up with their own account. Everyone can edit only their own name and color.
        </p>
      </div>

      <HouseSettings />
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
