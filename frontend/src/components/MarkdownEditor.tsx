import { forwardRef, useState, type ReactNode } from 'react';
import { Eye, PencilLine } from 'lucide-react';
import { Textarea } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { cn } from '@/lib/utils';

type Mode = 'write' | 'preview';

export interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
  id?: string;
  className?: string;
}

// Write/preview toggle on one axis: a side-by-side pane would be ~340px wide
// inside max-w-3xl, unreadable, and would break the 375px no-h-overflow rule.
export const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(
  function MarkdownEditor(
    { value, onChange, rows = 5, placeholder, invalid, disabled, id, className },
    ref,
  ) {
    const [mode, setMode] = useState<Mode>('write');
    const previewing = mode === 'preview';

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1" role="group" aria-label="编辑或预览">
          <ModeButton
            active={!previewing}
            onClick={() => setMode('write')}
            icon={<PencilLine className="h-3 w-3" />}
          >
            编辑
          </ModeButton>
          <ModeButton
            active={previewing}
            onClick={() => setMode('preview')}
            icon={<Eye className="h-3 w-3" />}
          >
            预览
          </ModeButton>
        </div>
        {previewing ? (
          <div
            className={cn(
              'w-full border border-rule rounded-sm px-3 py-2 bg-paper overflow-x-auto',
              className,
            )}
            style={{ minHeight: `${rows * 1.65 + 1.5}rem` }}
          >
            {value.trim() ? (
              <Markdown>{value}</Markdown>
            ) : (
              <p className="text-sm text-ink-3">暂无内容可预览。</p>
            )}
          </div>
        ) : (
          <Textarea
            ref={ref}
            id={id}
            rows={rows}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            invalid={invalid}
            disabled={disabled}
            className={cn('font-mono text-xs', className)}
          />
        )}
      </div>
    );
  },
);

function ModeButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm transition-colors',
        active ? 'bg-ink text-paper font-medium' : 'text-ink-3 hover:bg-paper-2 hover:text-ink',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
