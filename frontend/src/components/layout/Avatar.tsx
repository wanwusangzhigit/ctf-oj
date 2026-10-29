import { cn } from '@/lib/utils';

/**
 * Identity avatar — a small monospace tile with the user's initial.
 * Shape echoes the rest of the system (square, not circular),
 * tinted amber to read as a "callsign chip" rather than a generic profile bubble.
 */
const PALETTE: string[] = [
  'bg-amber-soft text-amber border-amber/30',
  'bg-moss-bg text-moss border-moss/30',
  'bg-oxblood-bg text-oxblood border-oxblood/30',
  'bg-paper-3 text-ink-2 border-rule',
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
        'inline-flex h-7 w-7 items-center justify-center rounded-sm',
        'text-xs font-mono font-medium border tabular-nums',
        tone,
        className,
      )}
    >
      {initial}
    </span>
  );
}
