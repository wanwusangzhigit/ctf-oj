import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

/**
 * Compact, sentence-case marker. Avoids the AI-default "tracked-out ALL-CAPS pill"
 * — keeps meta information legible without shouting.
 */
const TONE_CLS: Record<Tone, string> = {
  neutral: 'bg-paper-2 text-ink-2 border-rule',
  success: 'bg-moss-bg text-moss border-transparent',
  warning: 'bg-amber-soft text-amber border-transparent',
  danger:  'bg-oxblood-bg text-oxblood border-transparent',
  accent:  'bg-amber-soft text-amber border-transparent',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
}

export function Badge({ className, tone = 'neutral', ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 text-2xs',
        'font-medium rounded-sm border tabular-nums',
        TONE_CLS[tone],
        className,
      )}
      {...rest}
    />
  );
}
