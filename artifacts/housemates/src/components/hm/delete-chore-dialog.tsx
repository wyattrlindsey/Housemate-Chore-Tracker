import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import type { Chore } from '@/lib/types';
import { useStore } from '@/store/store';
import { toast } from '@/hooks/use-toast';

export function DeleteChoreDialog({
  chore,
  open,
  onOpenChange,
  onDeleted,
}: {
  chore: Chore;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDeleted?: () => void;
}) {
  const { deleteChore } = useStore();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await deleteChore(chore.id);
      toast({ title: 'Chore deleted', description: `"${chore.title}" was removed.` });
      onOpenChange(false);
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The chore could not be deleted.');
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!pending) { setError(null); onOpenChange(o); } }}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chore?</AlertDialogTitle>
          <AlertDialogDescription>
            "{chore.title}" will be removed for everyone in the house. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="rounded-xl bg-[hsl(var(--overdue-soft))] p-3 text-sm text-destructive" data-testid="error-delete-chore">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
          <Button
            data-testid="button-confirm-delete"
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => { void confirm(); }}
          >
            {pending ? 'Deleting…' : 'Delete chore'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
