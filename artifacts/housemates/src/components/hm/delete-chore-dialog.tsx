import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this chore?</AlertDialogTitle>
          <AlertDialogDescription>
            "{chore.title}" will be removed for good. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="button-cancel-delete">Keep it</AlertDialogCancel>
          <AlertDialogAction
            data-testid="button-confirm-delete"
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (deleteChore(chore.id)) {
                toast({ title: 'Chore deleted', description: `"${chore.title}" was removed.` });
                onDeleted?.();
              }
            }}
          >
            Delete chore
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
