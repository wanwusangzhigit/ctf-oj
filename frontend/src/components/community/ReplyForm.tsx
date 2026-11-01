import { type RefObject } from 'react';
import { Button, Textarea } from '@/components/ui';
import type { CommunityCopy } from '@/lib/communityCopy';

export function ReplyForm({
  copy,
  draft,
  quote,
  pending,
  textareaRef,
  onChange,
  onCancelQuote,
  onSubmit,
}: {
  copy: CommunityCopy;
  draft: string;
  quote: string | null;
  pending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
  onCancelQuote: () => void;
  onSubmit: () => void;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!draft.trim() || pending) return;
        onSubmit();
      }}
      className="space-y-2"
    >
      {quote && (
        <div className="flex items-center gap-2 text-2xs text-ink-3">
          正在回复 @{quote}
          <button type="button" onClick={onCancelQuote} className="text-amber">
            取消
          </button>
        </div>
      )}
      <Textarea
        ref={textareaRef}
        rows={5}
        value={draft}
        onChange={(e) => onChange(e.target.value)}
        placeholder={copy.reply_placeholder}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs text-ink-3">{copy.reply_hint}</span>
        <Button type="submit" size="sm" loading={pending} disabled={!draft.trim()}>
          {copy.reply_submit}
        </Button>
      </div>
    </form>
  );
}
