import { cn } from '@/lib/utils';

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HmAvatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string;
  color: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const sz = {
    xs: 'h-5 w-5 text-[9px]',
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-11 w-11 text-sm',
  }[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ring-2 ring-card',
        sz,
        className,
      )}
      style={{ backgroundColor: color }}
    >
      {initials(name)}
    </span>
  );
}
