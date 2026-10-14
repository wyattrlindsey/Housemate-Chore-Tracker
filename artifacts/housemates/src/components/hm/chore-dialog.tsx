import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ChoreEditorContext, useStore } from '@/store/store';
import type { ChoreStatus } from '@/lib/types';
import { fromKey, isValidKey, isoToLocalKey, todayKey } from '@/lib/dates';
import { HmAvatar } from './avatar';
import { StatusSegmented } from './status';
import { DeleteChoreDialog } from './delete-chore-dialog';
import { toast } from '@/hooks/use-toast';

const NONE = '__unassigned';

type Errors = Partial<Record<'title' | 'assignee' | 'dueDate' | 'form', string>>;

export function ChoreEditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ open: boolean; id: string | null; preset?: string }>({ open: false, id: null });
  const ctx = useMemo(
    () => ({
      openNew: (preset?: string) => setState({ open: true, id: null, preset }),
      openEdit: (id: string) => setState({ open: true, id }),
    }),
    [],
  );
  return (
    <ChoreEditorContext.Provider value={ctx}>
      {children}
      <ChoreDialog
        open={state.open}
        choreId={state.id}
        presetDate={state.preset}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
      />
    </ChoreEditorContext.Provider>
  );
}

function ChoreDialog({
  open,
  choreId,
  presetDate,
  onOpenChange,
}: {
  open: boolean;
  choreId: string | null;
  presetDate?: string;
  onOpenChange: (o: boolean) => void;
}) {
  const { chores, housemates, addChore, updateChore } = useStore();
  const chore = choreId ? chores.find((c) => c.id === choreId) : undefined;
  const isEdit = !!chore;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState(todayKey());
  const [status, setStatus] = useState<ChoreStatus>('To-do');
  const [errors, setErrors] = useState<Errors>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (chore) {
      setTitle(chore.title);
      setDescription(chore.description ?? '');
      setAssigneeId(chore.assigneeId ?? NONE);
      setDueDate(chore.dueDate ?? '');
      setStatus(chore.status);
    } else {
      setTitle('');
      setDescription('');
      setAssigneeId(housemates.length === 1 ? housemates[0].id : NONE);
      setDueDate(presetDate ?? todayKey());
      setStatus('To-do');
    }
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, choreId]);

  const validate = (): Errors => {
    const e: Errors = {};
    if (!title.trim()) e.title = 'Give the chore a short title.';
    else if (title.trim().length > 120) e.title = 'Keep the title under 120 characters.';
    if (assigneeId !== NONE && !housemates.some((h) => h.id === assigneeId)) e.assignee = 'That housemate is no longer in this house.';
    if (dueDate && !isValidKey(dueDate)) e.dueDate = 'That date is not valid.';
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (saving) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const first = e.title ? 'chore-title' : e.assignee ? 'chore-assignee' : 'chore-due';
      document.getElementById(first)?.focus();
      return;
    }
    const input = { title, description, assigneeId: assigneeId === NONE ? null : assigneeId, dueDate: dueDate || null, status };
    setSaving(true);
    try {
      if (isEdit) await updateChore(chore!.id, input);
      else await addChore(input);
      toast({ title: isEdit ? 'Changes saved' : 'Chore added', description: title.trim() });
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrors({ form: msg });
      toast({ variant: 'destructive', title: 'Not saved', description: msg });
    } finally {
      setSaving(false);
    }
  };

  const completedKey = chore ? isoToLocalKey(chore.completedAt) : null;
  const noHousemates = housemates.length === 0;
  const changeOpen = (o: boolean) => { if (!saving) onOpenChange(o); };

  return (
    <>
      <Dialog open={open && (!choreId || isEdit)} onOpenChange={changeOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-lg" data-testid="dialog-chore">
          <DialogHeader>
            <DialogTitle className="text-xl">{isEdit ? 'Edit chore' : 'Add a chore'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the details below.' : 'Something that needs doing around the home.'}
            </DialogDescription>
          </DialogHeader>

          {noHousemates ? (
            <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
              This house is still loading its members. Try again in a moment.
            </p>
          ) : (
            <form id="chore-form" onSubmit={(e) => { void submit(e); }} noValidate className="space-y-5">
              <fieldset disabled={saving} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="chore-title">Title</Label>
                <Input
                  id="chore-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Clean the oven"
                  aria-invalid={!!errors.title}
                  aria-describedby={errors.title ? 'err-title' : undefined}
                  data-testid="input-chore-title"
                  autoFocus
                  className="h-11 rounded-xl"
                />
                {errors.title && <p id="err-title" role="alert" className="text-sm text-destructive">{errors.title}</p>}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="chore-desc">
                  Description <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="chore-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Any helpful notes"
                  rows={3}
                  data-testid="input-chore-description"
                  className="resize-none rounded-xl"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="chore-assignee">Assigned to</Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger
                      id="chore-assignee"
                      aria-invalid={!!errors.assignee}
                      aria-describedby={errors.assignee ? 'err-assignee' : undefined}
                      data-testid="select-chore-assignee"
                      className="h-11 rounded-xl"
                    >
                      <SelectValue placeholder="Choose a housemate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE} data-testid="option-assignee-none">Unassigned</SelectItem>
                      {housemates.map((h) => (
                        <SelectItem key={h.id} value={h.id} data-testid={`option-assignee-${h.id}`}>
                          <span className="flex items-center gap-2">
                            <HmAvatar name={h.name} color={h.avatarColor} size="xs" className="ring-0" />
                            {h.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.assignee && <p id="err-assignee" role="alert" className="text-sm text-destructive">{errors.assignee}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="chore-due">Due date <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Input
                    id="chore-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    aria-invalid={!!errors.dueDate}
                    aria-describedby={errors.dueDate ? 'err-due' : undefined}
                    data-testid="input-chore-due"
                    className="h-11 rounded-xl"
                  />
                  {errors.dueDate && <p id="err-due" role="alert" className="text-sm text-destructive">{errors.dueDate}</p>}
                </div>
              </div>

              <div className="space-y-1.5">
                <span id="chore-status-label" className="text-sm font-medium">Status</span>
                <div className="overflow-x-auto">
                  <StatusSegmented value={status} onChange={setStatus} label="Status" idBase="dlg-status" size="md" />
                </div>
                {isEdit && status === 'Completed' && chore?.status === 'Completed' && completedKey && (
                  <p className="text-xs text-muted-foreground">Completed on {format(fromKey(completedKey), 'EEEE, MMM d')}</p>
                )}
              </div>
              {errors.form && <p role="alert" className="rounded-xl bg-[hsl(var(--overdue-soft))] p-3 text-sm text-destructive" data-testid="error-chore-form">{errors.form}</p>}
              </fieldset>
            </form>
          )}

          <DialogFooter className="mt-2 flex-row items-center gap-2 sm:justify-between">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="mr-auto text-destructive hover:bg-[hsl(var(--overdue-soft))] hover:text-destructive"
                data-testid="button-dialog-delete"
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            ) : (
              <span className="mr-auto" />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => changeOpen(false)} disabled={saving} className="rounded-xl" data-testid="button-cancel-chore">
                Cancel
              </Button>
              {!noHousemates && (
                <Button type="submit" form="chore-form" disabled={saving} className="rounded-xl" data-testid="button-save-chore">
                  {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add chore'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {chore && (
        <DeleteChoreDialog
          chore={chore}
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          onDeleted={() => onOpenChange(false)}
        />
      )}
    </>
  );
}
