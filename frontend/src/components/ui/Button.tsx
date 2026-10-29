import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const VARIANT_CLS: Record<Variant, string> = {
  primary:
    'bg-amber text-white border border-amber hover:bg-amber-hover hover:border-amber-hover disabled:opacity-50',
  secondary:
    'bg-paper-2 text-ink border border-rule hover:bg-paper-3 disabled:opacity-50',
  outline:
    'bg-transparent text-ink border border-rule-strong hover:bg-paper-2 disabled:opacity-50',
  ghost:
    'bg-transparent text-ink border border-transparent hover:bg-paper-2 disabled:opacity-50',
  danger:
    'bg-oxblood text-white border border-oxblood hover:opacity-90 disabled:opacity-50',
};

const SIZE_CLS: Record<Size, string> = {
  sm:   'h-7  px-2.5 text-2xs rounded-sm gap-1',
  md:   'h-9  px-3   text-sm  rounded   gap-1.5',
  lg:   'h-11 px-5   text-sm  rounded   gap-2',
  icon: 'h-8  w-8            rounded-sm',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function button(
  { className, variant = 'primary', size = 'md', loading, disabled, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium select-none',
        'transition-colors duration-120',
        'focus-visible:outline-none disabled:cursor-not-allowed',
        VARIANT_CLS[variant],
        SIZE_CLS[size],
        className,
      )}
      {...rest}
    >
      {loading && <Spinner className="h-3.5 w-3.5" />}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      role="img"
      aria-label="loading"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
