import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui';
import { cn, formatNumber } from '@/lib/utils';
import type { TopicSort } from '@/api/discussion';
import type { CommunityCopy } from '@/lib/communityCopy';

const SORTS: [TopicSort, string][] = [
  ['last_reply', '最近回复'],
  ['newest', '最新发布'],
  ['oldest', '最早发布'],
];

export function TopicFilters({
  copy,
  sort,
  tag,
  q,
  total,
  onParam,
}: {
  copy: CommunityCopy;
  sort: TopicSort;
  tag: string;
  q: string;
  total: number;
  onParam: (key: string, value: string) => void;
}) {
  const [draft, setDraft] = useState(q);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  return (
    <div className="space-y-2">
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onParam('q', draft.trim());
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.search_placeholder}
            className="h-8 pl-8 text-xs"
            aria-label={copy.search_placeholder}
          />
        </div>
        {q && (
          <button
            type="button"
            onClick={() => {
              setDraft('');
              onParam('q', '');
            }}
            className="text-ink-3 hover:text-ink"
            aria-label="清除搜索"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      <div className="flex flex-wrap items-center gap-1 border-b border-rule pb-2">
        {SORTS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => onParam('sort', value === 'last_reply' ? '' : value)}
            className={cn(
              'h-7 px-2 text-2xs rounded-sm transition-colors',
              sort === value
                ? 'bg-ink text-paper font-medium'
                : 'text-ink-3 hover:bg-paper-2 hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
        {tag && (
          <button
            type="button"
            onClick={() => onParam('tag', '')}
            className="ml-1 inline-flex items-center gap-1 h-7 px-2 text-2xs border border-rule rounded-sm text-ink-2 hover:border-rule-strong"
          >
            #{tag}
            <X className="h-3 w-3" />
          </button>
        )}
        <span className="ml-auto font-mono text-2xs text-ink-3 tabular-nums">
          {formatNumber(total)} 个主题
        </span>
      </div>
    </div>
  );
}
