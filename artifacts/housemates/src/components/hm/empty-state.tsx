import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  testId,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: ReactNode;
  testId?: string;
}) {
  return (
    <div data-testid={testId} className="animate-rise flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-14 text-center">
      <div className="relative mb-5">
        <span aria-hidden="true" className="absolute -inset-3 rounded-full bg-accent/60" />
        <span className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-card text-primary shadow-soft">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </span>
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
