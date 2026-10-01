import { Check } from 'lucide-react';
import { useStore } from '@/store/store';
import { HmAvatar } from './avatar';

export function CalendarLegend() {
  const { housemates } = useStore();
  return (
    <div className="mt-5 border-t border-border pt-4" data-testid="legend-calendar">
      <h3 className="sr-only">Legend</h3>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-xs text-muted-foreground">
        {housemates.map((h) => (
          <span key={h.id} className="inline-flex items-center gap-1.5">
            <HmAvatar name={h.name} color={h.avatarColor} size="xs" className="ring-0" />
            <span className="font-medium text-foreground">{h.name}</span>
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded-sm border-l-[3px] border-primary bg-primary/10" aria-hidden="true" />
          Chore on its due date, colored by assignee
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary" aria-hidden="true">
            <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
          </span>
          Completed on this day
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3.5 w-5 rounded-sm bg-muted ring-1 ring-[hsl(var(--overdue)/0.6)]" aria-hidden="true" />
          Overdue
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[11px] line-through">Struck through</span>
          Already completed
        </span>
      </div>
    </div>
  );
}
