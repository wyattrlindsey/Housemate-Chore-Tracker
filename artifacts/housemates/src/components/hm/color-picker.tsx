import { Check } from 'lucide-react';
import { AVATAR_COLORS } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ColorPicker({ value, onChange, idBase }: { value: string; onChange: (c: string) => void; idBase: string }) {
  return (
    <div role="radiogroup" aria-label="Avatar color" className="flex flex-wrap gap-2">
      {AVATAR_COLORS.map((c, i) => {
        const active = c.value.toLowerCase() === value.toLowerCase();
        return (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={c.name}
            title={c.name}
            onClick={() => onChange(c.value)}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
              e.preventDefault();
              const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + AVATAR_COLORS.length) % AVATAR_COLORS.length;
              onChange(AVATAR_COLORS[n].value);
              document.getElementById(`${idBase}-${n}`)?.focus();
            }}
            id={`${idBase}-${i}`}
            tabIndex={active || (!AVATAR_COLORS.some((x) => x.value === value) && i === 0) ? 0 : -1}
            data-testid={`button-color-${idBase}-${i}`}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active && 'ring-2 ring-offset-2 ring-offset-card',
            )}
            style={{ backgroundColor: c.value, ['--tw-ring-color' as string]: active ? c.value : undefined }}
          >
            {active && <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
