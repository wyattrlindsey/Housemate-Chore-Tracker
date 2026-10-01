import { useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Mail, RefreshCw } from 'lucide-react';
import {
  getGetReminderStatusQueryKey,
  useGetReminderStatus,
  useSendReminders,
  type ReminderInput,
  type ReminderStatus,
} from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { todayKey } from '@/lib/dates';
import { buildReminderPayload, reminderEmptyMessage } from '@/lib/reminders';
import { useStore } from '@/store/store';
import { toast } from '@/hooks/use-toast';

function timestamp(value: string | null | undefined): number {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

function remainingLabel(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours ? `${hours}h ` : ''}${minutes}m ${rest}s`;
}

export function ReminderControl() {
  const { housemates, chores } = useStore();
  const queryClient = useQueryClient();
  const queryKey = getGetReminderStatusQueryKey();
  const status = useGetReminderStatus({
    query: {
      queryKey,
      refetchInterval: 30_000,
      refetchOnWindowFocus: 'always',
      refetchOnMount: 'always',
      staleTime: 15_000,
      retry: false,
    },
  });
  const [now, setNow] = useState(() => Date.now());
  // Keep a reservation from a POST even if a failed/stale GET cannot confirm it.
  const [reservation, setReservation] = useState<{ until: number; offset: number; observedAt: number } | null>(null);
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState<ReminderInput | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const sendLock = useRef(false);
  const invalidatedExpiry = useRef(0);
  const latest = useRef({ housemates, chores });
  latest.current = { housemates, chores };

  const serverTimestamp = timestamp(status.data?.serverNow);
  const queryOffset = serverTimestamp ? serverTimestamp - status.dataUpdatedAt : 0;
  const clockOffset = reservation && reservation.observedAt >= status.dataUpdatedAt ? reservation.offset : queryOffset;
  const nextAllowedAt = Math.max(timestamp(status.data?.nextAllowedAt), reservation?.until ?? 0);
  const remaining = Math.max(0, Math.ceil((nextAllowedAt - (now + clockOffset)) / 1000));
  const coolingDown = remaining > 0;
  const emptyMessage = reminderEmptyMessage(housemates, chores);
  const localToday = todayKey();
  const livePayload = useMemo(() => buildReminderPayload(housemates, chores, localToday), [housemates, chores, localToday]);
  const reviewChanged = reviewed !== null && JSON.stringify(reviewed) !== JSON.stringify(livePayload);
  const statusUnknown = status.isError || !status.data || !serverTimestamp;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (nextAllowedAt && !coolingDown && invalidatedExpiry.current !== nextAllowedAt) {
      invalidatedExpiry.current = nextAllowedAt;
      void queryClient.invalidateQueries({ queryKey: getGetReminderStatusQueryKey() });
    }
  }, [coolingDown, nextAllowedAt, queryClient]);

  const rememberReservation = (until: string | undefined, serverNow: string | undefined) => {
    const deadline = timestamp(until);
    if (!deadline) return;
    const observedAt = Date.now();
    const returnedNow = timestamp(serverNow);
    setReservation({
      until: deadline,
      offset: returnedNow ? returnedNow - observedAt : clockOffset,
      observedAt,
    });
    setNow(observedAt);
  };

  const mutation = useSendReminders({
    mutation: {
      retry: false,
      onSuccess: (result) => {
        rememberReservation(result.nextAllowedAt, result.serverNow);
        queryClient.setQueryData<ReminderStatus>(queryKey, {
          configured: true,
          nextAllowedAt: result.nextAllowedAt,
          serverNow: result.serverNow,
        });
        const text = `Reminders sent to ${result.sent} housemates`;
        setMessage(text);
        toast({ title: text });
        setOpen(false);
      },
      onError: (error) => {
        const details = error.data;
        rememberReservation(details?.nextAllowedAt, details?.serverNow);
        if (details?.nextAllowedAt && details.serverNow) {
          queryClient.setQueryData<ReminderStatus>(queryKey, (previous) => previous ? {
            ...previous,
            nextAllowedAt: details.nextAllowedAt!,
            serverNow: details.serverNow!,
          } : undefined);
        }
        const text = details?.error ?? 'Could not send reminders. Delivery may be uncertain; check availability before trying again.';
        setMessage(text);
        toast({ variant: 'destructive', title: 'Reminders could not be confirmed', description: text });
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey }),
    },
  });

  const sending = checking || mutation.isPending;
  const disabled = sending || coolingDown || statusUnknown || !status.data?.configured || !!emptyMessage;
  // Empty/setup states remain actionable so the user can learn what to fix;
  // actual sending always requires a successful status check and recipients.
  const buttonDisabled = sending || coolingDown || (statusUnknown && !emptyMessage);

  const requestConfirmation = () => {
    if (buttonDisabled || sendLock.current) return;
    if (emptyMessage) {
      setMessage(emptyMessage);
      toast({ title: 'No reminders to send', description: emptyMessage });
      return;
    }
    if (!status.data?.configured) {
      setMessage("Reminder emails aren't configured yet");
      toast({ title: "Reminder emails aren't configured yet", description: 'The reminder service needs to be configured before emails can be sent.' });
      return;
    }
    if (disabled) return;
    setReviewed(buildReminderPayload(latest.current.housemates, latest.current.chores));
    setMessage(null);
    setOpen(true);
  };

  const confirm = async () => {
    if (!open || disabled || sendLock.current || !reviewed) return;
    let payload = buildReminderPayload(latest.current.housemates, latest.current.chores);
    // A changed recipient or chore requires another explicit review/confirmation.
    if (JSON.stringify(payload) !== JSON.stringify(reviewed)) {
      setReviewed(payload);
      setMessage('The recipients or chores changed. Please review the updated list and confirm again.');
      return;
    }
    if (!payload.reminders.length) {
      setMessage(reminderEmptyMessage(latest.current.housemates, latest.current.chores));
      return;
    }
    sendLock.current = true;
    setChecking(true);
    try {
      // Recheck the shared server cooldown immediately before a confirmed send.
      const fresh = await status.refetch();
      if (fresh.isError || !fresh.data || !timestamp(fresh.data.serverNow)) {
        setMessage('Could not check reminder availability. Retry the status check before sending.');
        return;
      }
      if (!fresh.data.configured) {
        setMessage("Reminder emails aren't configured yet");
        return;
      }
      if (timestamp(fresh.data.nextAllowedAt) > timestamp(fresh.data.serverNow)) {
        rememberReservation(fresh.data.nextAllowedAt ?? undefined, fresh.data.serverNow);
        setMessage('Someone has already requested reminders. Please wait until the shared cooldown ends.');
        return;
      }
      payload = buildReminderPayload(latest.current.housemates, latest.current.chores);
      if (JSON.stringify(payload) !== JSON.stringify(reviewed)) {
        setReviewed(payload);
        setMessage('The recipients or chores changed. Please review the updated list and confirm again.');
        return;
      }
      await mutation.mutateAsync({ data: payload });
    } catch {
      // The mutation's onError displays the API error and retains any cooldown.
    } finally {
      sendLock.current = false;
      setChecking(false);
    }
  };

  const statusText = status.isError
    ? `Could not check reminder availability.${status.error?.data?.error ? ` ${status.error.data.error}` : ''}`
    : !status.data
      ? 'Checking reminder availability…'
      : !serverTimestamp
        ? 'Could not verify the server time. Retry the status check before sending.'
        : !status.data.configured
          ? "Reminder emails aren't configured yet"
          : null;

  return (
    <div className="flex max-w-sm flex-col items-start gap-2 sm:items-end">
      <Button onClick={requestConfirmation} disabled={buttonDisabled} variant="outline" className="rounded-xl bg-card" data-testid="button-remind-everyone">
        <Mail className="mr-1.5 h-4 w-4" />
        {sending ? 'Sending reminders…' : 'Remind everyone'}
      </Button>
      {emptyMessage && <p className="text-xs text-muted-foreground sm:text-right" data-testid="text-reminder-empty">{emptyMessage}</p>}
      {statusText && <p className="text-xs text-muted-foreground sm:text-right" data-testid="text-reminder-status">{statusText}</p>}
      {(status.isError || (status.data && !serverTimestamp)) && (
        <Button onClick={() => { void status.refetch(); }} disabled={status.isFetching || sending} variant="ghost" size="sm" className="h-8 rounded-lg" data-testid="button-retry-reminder-status">
          <RefreshCw className={`mr-1.5 h-3.5 w-3.5${status.isFetching ? ' animate-spin' : ''}`} /> Retry status check
        </Button>
      )}
      {coolingDown && (
        <p className="text-xs text-muted-foreground sm:text-right" data-testid="text-reminder-cooldown">
          Available again at {new Date(nextAllowedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          {' · '}{remainingLabel(remaining)} remaining.
          <span className="block">One reminder attempt per hour, shared by everyone.</span>
        </p>
      )}
      {message && <p role="status" className="text-xs text-muted-foreground sm:text-right" data-testid="text-reminder-result">{message}</p>}

      <Dialog open={open} onOpenChange={(value) => { if (!sendLock.current) setOpen(value); }}>
        <DialogContent className="rounded-2xl sm:max-w-md" data-testid="dialog-reminders">
          <DialogHeader>
            <DialogTitle className="text-xl">Send reminders to {reviewed?.reminders.length ?? 0} housemates?</DialogTitle>
            <DialogDescription>
              Each person below will receive their unfinished chores. Check the email destinations before sending.
              Only one reminder attempt is allowed per hour for everyone, even if delivery cannot be confirmed.
            </DialogDescription>
          </DialogHeader>
          <ul className="max-h-64 space-y-3 overflow-y-auto rounded-xl bg-muted/60 p-4" aria-label="Reminder recipients">
            {reviewed?.reminders.map((recipient, index) => (
              <li key={`${recipient.email}-${index}`} data-testid={`reminder-recipient-${index}`}>
                <p className="font-medium">{recipient.name}</p>
                <p className="break-all text-sm text-muted-foreground">{recipient.email}</p>
                <p className="text-xs text-muted-foreground">{recipient.chores.length} unfinished chore{recipient.chores.length === 1 ? '' : 's'}</p>
              </li>
            ))}
          </ul>
          {emptyMessage && <p className="text-sm text-muted-foreground" data-testid="text-reminder-dialog-empty">{emptyMessage}</p>}
          {statusText && <p className="text-sm text-muted-foreground" data-testid="text-reminder-dialog-status">{statusText}</p>}
          {(status.isError || (status.data && !serverTimestamp)) && (
            <Button onClick={() => { void status.refetch(); }} disabled={status.isFetching || sending} variant="outline" size="sm" className="justify-self-start rounded-xl" data-testid="button-retry-reminder-dialog-status">
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5${status.isFetching ? ' animate-spin' : ''}`} /> Retry status check
            </Button>
          )}
          {reviewChanged && <p role="alert" className="text-sm text-muted-foreground" data-testid="text-reminder-review-changed">The chore list changed. Select Send reminders to review the updated recipients before confirming again.</p>}
          {message && <p role="status" className="text-sm text-muted-foreground" data-testid="text-reminder-dialog-result">{message}</p>}
          {coolingDown && <p className="text-sm text-muted-foreground" data-testid="text-reminder-dialog-cooldown">Available again at {new Date(nextAllowedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · {remainingLabel(remaining)} remaining.</p>}
          <DialogFooter className="flex-row justify-end gap-2">
            <Button onClick={() => setOpen(false)} disabled={sending} variant="outline" className="rounded-xl" data-testid="button-cancel-reminders">Cancel</Button>
            <Button onClick={() => { void confirm(); }} disabled={disabled || !reviewed?.reminders.length} className="rounded-xl" data-testid="button-confirm-reminders">
              {sending ? 'Sending…' : 'Send reminders'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}