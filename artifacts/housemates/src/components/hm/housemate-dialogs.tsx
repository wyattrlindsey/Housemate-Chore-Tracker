import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AVATAR_COLORS } from '@/lib/types';
import { useStore } from '@/store/store';
import { HmAvatar } from './avatar';
import { ColorPicker } from './color-picker';
import { toast } from '@/hooks/use-toast';

const message = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

function FormError({ text, testId }: { text: string | null; testId: string }) {
  if (!text) return null;
  return <p role="alert" className="rounded-xl bg-[hsl(var(--overdue-soft))] p-3 text-sm text-destructive" data-testid={testId}>{text}</p>;
}

/** Edit your own display name and avatar color. */
export function ProfileDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { me, updateProfile } = useStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(me?.name ?? '');
    setColor(me?.avatarColor ?? AVATAR_COLORS[0].value);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const n = name.trim();
    if (!n) return setError('Enter a name.');
    if (n.length > 40) return setError('Keep the name under 40 characters.');
    setPending(true);
    setError(null);
    try {
      await updateProfile({ displayName: n, avatarColor: color });
      toast({ title: 'Profile updated', description: n });
      onOpenChange(false);
    } catch (err) {
      setError(message(err, 'Your profile could not be saved.'));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent className="rounded-2xl sm:max-w-md" data-testid="dialog-profile">
        <DialogHeader>
          <DialogTitle className="text-xl">Your profile</DialogTitle>
          <DialogDescription>Your name and color show up on chores and the calendar in every house you share.</DialogDescription>
        </DialogHeader>
        <form id="profile-form" onSubmit={(e) => { void submit(e); }} noValidate className="space-y-5">
          <fieldset disabled={pending} className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl bg-muted/60 p-4">
              <HmAvatar name={name || '?'} color={color} size="lg" className="transition-colors duration-300" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{name.trim() || 'Your name'}</p>
                <p className="text-xs text-muted-foreground">Preview</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Display name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus data-testid="input-profile-name" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium">Avatar color</span>
              <ColorPicker value={color} onChange={setColor} idBase="profile-color" />
            </div>
            <FormError text={error} testId="error-profile" />
          </fieldset>
        </form>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending} className="rounded-xl" data-testid="button-cancel-profile">Cancel</Button>
          <Button type="submit" form="profile-form" disabled={pending} className="rounded-xl" data-testid="button-save-profile">
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Create a new house or join one with an invite code. Used in onboarding and settings. */
export function HouseForms({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const { createHouse, joinHouse } = useStore();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<'create' | 'join' | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [joinError, setJoinError] = useState<string | null>(null);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const n = name.trim();
    if (!n) return setCreateError('Give your house a name.');
    if (n.length > 60) return setCreateError('Keep the name under 60 characters.');
    setPending('create');
    setCreateError(null);
    try {
      await createHouse(n);
      toast({ title: 'House created', description: `Share the invite code so housemates can join ${n}.` });
      onDone?.();
    } catch (err) {
      setCreateError(message(err, 'The house could not be created.'));
    } finally {
      setPending(null);
    }
  };

  const join = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (!code.trim()) return setJoinError('Enter the invite code a housemate shared with you.');
    setPending('join');
    setJoinError(null);
    try {
      await joinHouse(code);
      toast({ title: 'You joined the house' });
      onDone?.();
    } catch (err) {
      setJoinError(message(err, 'Could not join that house.'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className={compact ? 'grid gap-5' : 'grid gap-4 md:grid-cols-2'}>
      <form onSubmit={(e) => { void create(e); }} noValidate className="rounded-2xl border border-card-border bg-card p-5 shadow-soft" data-testid="form-create-house">
        <h3 className="font-semibold">Start a new house</h3>
        <p className="mt-1 text-sm text-muted-foreground">You'll be the owner and get an invite code to share.</p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="house-name">House name</Label>
          <Input id="house-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Elm Street flat" disabled={!!pending} data-testid="input-house-name" className="h-11 rounded-xl" />
        </div>
        <div className="mt-3"><FormError text={createError} testId="error-create-house" /></div>
        <Button type="submit" disabled={!!pending} className="mt-3 w-full rounded-xl" data-testid="button-create-house">
          {pending === 'create' ? 'Creating…' : 'Create house'}
        </Button>
      </form>
      <form onSubmit={(e) => { void join(e); }} noValidate className="rounded-2xl border border-card-border bg-card p-5 shadow-soft" data-testid="form-join-house">
        <h3 className="font-semibold">Join with an invite code</h3>
        <p className="mt-1 text-sm text-muted-foreground">Ask a housemate for the code in their house settings.</p>
        <div className="mt-4 space-y-1.5">
          <Label htmlFor="invite-code">Invite code</Label>
          <Input id="invite-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. 7F3A9C2B" autoCapitalize="characters" disabled={!!pending} data-testid="input-invite-code" className="h-11 rounded-xl font-mono tracking-widest" />
        </div>
        <div className="mt-3"><FormError text={joinError} testId="error-join-house" /></div>
        <Button type="submit" variant="outline" disabled={!!pending} className="mt-3 w-full rounded-xl" data-testid="button-join-house">
          {pending === 'join' ? 'Joining…' : 'Join house'}
        </Button>
      </form>
    </div>
  );
}

export function AddHouseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-md" data-testid="dialog-add-house">
        <DialogHeader>
          <DialogTitle className="text-xl">Add another house</DialogTitle>
          <DialogDescription>You can belong to several houses and switch between them from the top bar.</DialogDescription>
        </DialogHeader>
        <HouseForms compact onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

export function LeaveHouseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { currentHouse, housemates, chores, userId, leaveHouse } = useStore();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mine = chores.filter((c) => c.assigneeId === userId).length;
  const others = housemates.filter((h) => h.id !== userId);
  const isOwner = currentHouse?.role === 'owner';
  const successor = others[0];
  const last = others.length === 0;

  useEffect(() => { if (open) setError(null); }, [open]);

  const confirm = async () => {
    if (pending || !currentHouse) return;
    const name = currentHouse.name;
    setPending(true);
    setError(null);
    try {
      await leaveHouse();
      toast({ title: `You left ${name}` });
      onOpenChange(false);
    } catch (err) {
      const text = message(err, 'Could not leave the house.');
      setError(text);
      // The view may switch houses (e.g. already removed), so also surface it as a toast.
      toast({ variant: 'destructive', title: 'Could not leave the house', description: text });
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!pending) onOpenChange(o); }}>
      <DialogContent className="rounded-2xl sm:max-w-md" data-testid="dialog-leave-house">
        <DialogHeader>
          <DialogTitle className="text-xl">Leave {currentHouse?.name}?</DialogTitle>
          <DialogDescription>Here's what will happen when you leave:</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2.5 rounded-xl bg-muted/60 p-4 text-sm" data-testid="list-leave-consequences">
          <li>
            <span className="font-medium">Your chores become unassigned.</span>{' '}
            {mine > 0
              ? `${mine} chore${mine === 1 ? '' : 's'} assigned to you will stay in the house with nobody assigned.`
              : 'You have no chores assigned here, so nothing changes on the list.'}
          </li>
          {!last && isOwner && (
            <li>
              <span className="font-medium">Ownership moves on.</span> You're the owner, so ownership passes to the longest-standing remaining member{successor ? ` (${successor.name})` : ''}.
            </li>
          )}
          {last ? (
            <li className="text-destructive">
              <span className="font-medium">The house will be deleted.</span> You're the last member, so the house and all of its chores are removed for good.
            </li>
          ) : (
            <li>You'll need a fresh invite code to rejoin later.</li>
          )}
        </ul>
        <FormError text={error} testId="error-leave-house" />
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending} className="rounded-xl" data-testid="button-cancel-leave">Stay</Button>
          <Button onClick={() => { void confirm(); }} disabled={pending} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-leave">
            {pending ? 'Leaving…' : last ? 'Leave and delete house' : 'Leave house'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
