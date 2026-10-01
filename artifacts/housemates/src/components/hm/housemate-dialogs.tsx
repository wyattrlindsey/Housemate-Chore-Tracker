import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AVATAR_COLORS, type Housemate } from '@/lib/types';
import { useStore } from '@/store/store';
import { HmAvatar } from './avatar';
import { ColorPicker } from './color-picker';
import { toast } from '@/hooks/use-toast';

export function HousemateFormDialog({
  open,
  onOpenChange,
  housemate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  housemate?: Housemate;
}) {
  const { housemates, addHousemate, updateHousemate } = useStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVATAR_COLORS[0].value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (housemate) {
      setName(housemate.name);
      setColor(housemate.avatarColor);
    } else {
      setName('');
      const used = new Set(housemates.map((h) => h.avatarColor));
      setColor((AVATAR_COLORS.find((c) => !used.has(c.value)) ?? AVATAR_COLORS[0]).value);
    }
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, housemate?.id]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) {
      setError('Enter a name.');
      document.getElementById('hm-name')?.focus();
      return;
    }
    if (n.length > 40) {
      setError('Keep the name under 40 characters.');
      return;
    }
    const ok = housemate ? updateHousemate(housemate.id, { name: n, avatarColor: color }) : addHousemate(n, color);
    if (ok) {
      toast({ title: housemate ? 'Housemate updated' : `${n} moved in`, description: housemate ? n : 'They can now be assigned chores.' });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md" data-testid="dialog-housemate">
        <DialogHeader>
          <DialogTitle className="text-xl">{housemate ? 'Edit housemate' : 'Add a housemate'}</DialogTitle>
          <DialogDescription>Their color shows up on chores and the calendar.</DialogDescription>
        </DialogHeader>
        <form id="hm-form" onSubmit={submit} noValidate className="space-y-5">
          <div className="flex items-center gap-4 rounded-xl bg-muted/60 p-4">
            <HmAvatar name={name || '?'} color={color} size="lg" className="transition-colors duration-300" />
            <div className="min-w-0">
              <p className="truncate font-semibold">{name.trim() || 'New housemate'}</p>
              <p className="text-xs text-muted-foreground">Preview</p>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="hm-name">Name</Label>
            <Input
              id="hm-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jordan"
              autoFocus
              aria-invalid={!!error}
              aria-describedby={error ? 'hm-name-err' : undefined}
              data-testid="input-housemate-name"
              className="h-11 rounded-xl"
            />
            {error && <p id="hm-name-err" role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
          <div className="space-y-2">
            <span className="text-sm font-medium">Avatar color</span>
            <ColorPicker value={color} onChange={setColor} idBase="hm-color" />
          </div>
        </form>
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" data-testid="button-cancel-housemate">Cancel</Button>
          <Button type="submit" form="hm-form" className="rounded-xl" data-testid="button-save-housemate">
            {housemate ? 'Save' : 'Add housemate'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RemoveHousemateDialog({
  open,
  onOpenChange,
  housemate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  housemate: Housemate;
}) {
  const { housemates, chores, removeHousemate } = useStore();
  const assigned = chores.filter((c) => c.assigneeId === housemate.id);
  const others = housemates.filter((h) => h.id !== housemate.id);
  const [target, setTarget] = useState('');
  const [error, setError] = useState<string | null>(null);
  const blocked = assigned.length > 0 && others.length === 0;

  useEffect(() => {
    if (open) {
      setTarget(others.length === 1 ? others[0].id : '');
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const confirm = () => {
    if (assigned.length > 0 && !target) {
      setError('Choose who takes over these chores.');
      document.getElementById('reassign-to')?.focus();
      return;
    }
    if (removeHousemate(housemate.id, target || undefined)) {
      const to = others.find((o) => o.id === target);
      toast({
        title: `${housemate.name} removed`,
        description: assigned.length && to ? `${assigned.length} chore${assigned.length > 1 ? 's' : ''} moved to ${to.name}.` : undefined,
      });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md" data-testid="dialog-remove-housemate">
        <DialogHeader>
          <DialogTitle className="text-xl">Remove {housemate.name}?</DialogTitle>
          <DialogDescription>
            {blocked
              ? `${housemate.name} still has ${assigned.length} chore${assigned.length > 1 ? 's' : ''} and is the only housemate. Add someone else to hand them over to, or delete those chores first.`
              : assigned.length > 0
                ? `${housemate.name} has ${assigned.length} chore${assigned.length > 1 ? 's' : ''}. Choose who takes them over so nothing gets lost.`
                : `${housemate.name} has no chores assigned, so nothing else will change.`}
          </DialogDescription>
        </DialogHeader>
        {!blocked && assigned.length > 0 && (
          <div className="space-y-1.5">
            <Label htmlFor="reassign-to">Reassign chores to</Label>
            <Select value={target} onValueChange={(v) => { setTarget(v); setError(null); }}>
              <SelectTrigger id="reassign-to" className="h-11 rounded-xl" aria-invalid={!!error} aria-describedby={error ? 'reassign-err' : undefined} data-testid="select-reassign">
                <SelectValue placeholder="Choose a housemate" />
              </SelectTrigger>
              <SelectContent>
                {others.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-2">
                      <HmAvatar name={h.name} color={h.avatarColor} size="xs" className="ring-0" />
                      {h.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && <p id="reassign-err" role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="flex-row justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl" data-testid="button-cancel-remove">
            {blocked ? 'Got it' : 'Cancel'}
          </Button>
          {!blocked && (
            <Button onClick={confirm} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-remove">
              {assigned.length > 0 ? 'Reassign and remove' : 'Remove'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
