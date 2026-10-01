import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { AVATAR_COLORS, type Housemate } from '@/lib/types';
import { useStore } from '@/store/store';
import { HmAvatar } from './avatar';
import { ColorPicker } from './color-picker';
import { toast } from '@/hooks/use-toast';
import { isValidEmail, normalizeEmail } from '@/lib/email';

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
  const form = useForm<{ name: string; email: string; avatarColor: string }>({
    defaultValues: { name: '', email: '', avatarColor: AVATAR_COLORS[0].value },
  });
  const name = form.watch('name');
  const color = form.watch('avatarColor');

  useEffect(() => {
    if (!open) return;
    const current = housemates.find((h) => h.id === housemate?.id);
    const used = new Set(housemates.map((h) => h.avatarColor));
    form.reset({
      name: current?.name ?? '',
      email: normalizeEmail(current?.email) ?? '',
      avatarColor: current?.avatarColor ?? (AVATAR_COLORS.find((c) => !used.has(c.value)) ?? AVATAR_COLORS[0]).value,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, housemate?.id]);

  const submit = form.handleSubmit((values) => {
    const n = values.name.trim();
    const email = normalizeEmail(values.email);
    const ok = housemate
      ? updateHousemate(housemate.id, { name: n, avatarColor: values.avatarColor, email })
      : addHousemate(n, values.avatarColor, email);
    if (ok) {
      toast({ title: housemate ? 'Housemate updated' : `${n} moved in`, description: housemate ? n : 'They can now be assigned chores.' });
      onOpenChange(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-md" data-testid="dialog-housemate">
        <DialogHeader>
          <DialogTitle className="text-xl">{housemate ? 'Edit housemate' : 'Add a housemate'}</DialogTitle>
          <DialogDescription>Their color shows up on chores and the calendar.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form id="hm-form" onSubmit={submit} noValidate className="space-y-5">
            <div className="flex items-center gap-4 rounded-xl bg-muted/60 p-4">
              <HmAvatar name={name || '?'} color={color} size="lg" className="transition-colors duration-300" />
              <div className="min-w-0">
                <p className="truncate font-semibold">{name.trim() || 'New housemate'}</p>
                <p className="text-xs text-muted-foreground">Preview</p>
              </div>
            </div>
            <FormField
              control={form.control}
              name="name"
              rules={{ validate: (value) => !value.trim() ? 'Enter a name.' : value.trim().length > 40 ? 'Keep the name under 40 characters.' : true }}
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Jordan" autoFocus data-testid="input-housemate-name" className="h-11 rounded-xl" />
                  </FormControl>
                  <FormMessage role="alert" data-testid="error-housemate-name" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              rules={{ validate: (value) => !normalizeEmail(value) || isValidEmail(value.trim()) || 'Enter a valid email address, or leave it blank.' }}
              render={({ field }) => (
                <FormItem className="space-y-1.5">
                  <FormLabel>Email <span className="font-normal text-muted-foreground">(optional)</span></FormLabel>
                  <FormControl>
                    <Input {...field} type="email" autoComplete="email" placeholder="e.g. jordan@example.com" data-testid="input-housemate-email" className="h-11 rounded-xl" />
                  </FormControl>
                  <FormDescription className="text-xs">Used only when you choose to send chore reminders.</FormDescription>
                  <FormMessage role="alert" data-testid="error-housemate-email" />
                </FormItem>
              )}
            />
            <div className="space-y-2">
              <span className="text-sm font-medium">Avatar color</span>
              <ColorPicker value={color} onChange={(value) => form.setValue('avatarColor', value)} idBase="hm-color" />
            </div>
          </form>
        </Form>
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
