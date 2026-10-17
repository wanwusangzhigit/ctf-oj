import { cn } from '@/lib/utils';

const PALETTE: string[] = [
  'bg-accent/15 text-accent',
  'bg-success/15 text-success',
  'bg-warning/15 text-warning',
  'bg-danger/15 text-danger',
];

function hashIndex(s: string, mod: number): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h % mod;
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const tone = PALETTE[hashIndex(name, PALETTE.length)];
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium',
        tone,
        className,
      )}
    >
      {initial}
    </span>
  );
}
