import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function input(
  { className, invalid, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(
        'w-full h-9 px-3 bg-paper border border-rule rounded-sm text-sm',
        'placeholder:text-ink-3/70 placeholder:font-normal',
        'focus:outline-none focus:border-amber',
        'disabled:bg-paper-2 disabled:cursor-not-allowed',
        'transition-colors duration-120',
        invalid ? 'border-oxblood' : 'border-rule',
        className,
      )}
      {...rest}
    />
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function textarea(
  { className, invalid, rows = 4, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        'w-full px-3 py-2 bg-paper border rounded-sm text-sm leading-relaxed',
        'placeholder:text-ink-3/70',
        'focus:outline-none focus:border-amber',
        'transition-colors duration-120',
        invalid ? 'border-oxblood' : 'border-rule',
        className,
      )}
      {...rest}
    />
  );
});

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-sm font-medium text-ink"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-2xs text-oxblood">{error}</p>
      ) : hint ? (
        <p className="text-2xs text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}
