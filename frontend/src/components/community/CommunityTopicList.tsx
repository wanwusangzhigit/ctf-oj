import { Spinner } from '@/components/ui';
import { TopicRow } from './TopicRow';
import type { CommunityCopy } from '@/lib/communityCopy';
import type { CommunitySectionView, Discussion } from '@/types';

export function CommunityTopicList({
  topics,
  isLoading,
  isError,
  copy,
  filtered,
  sections,
  page,
  totalPages,
  onParam,
  onClearFilters,
}: {
  topics: Discussion[];
  isLoading: boolean;
  isError: boolean;
  copy: CommunityCopy;
  filtered: boolean;
  // Boards worth labelling on a row: empty once the list is already narrowed
  // to one board, where every row would repeat the same chip.
  sections: CommunitySectionView[];
  page: number;
  totalPages: number;
  onParam: (key: string, value: string) => void;
  onClearFilters: () => void;
}) {
  const sectionNames = new Map(sections.map((s) => [s.id, s.name]));
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-12 text-sm text-ink-3">{copy.load_failed}</p>;
  }

  if (topics.length === 0) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm text-ink-3">{filtered ? copy.empty_filtered : copy.empty_board}</p>
        {filtered && (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 text-sm text-amber"
          >
            清除筛选
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-4 border-b border-rule-strong px-3 py-2 font-mono text-2xs text-ink-3">
        <span>主题</span>
        <span className="text-right">回复</span>
        <span className="text-right">浏览</span>
      </div>
      <div className="border-b border-rule">
        {topics.map((d) => (
          <TopicRow
            key={d.id}
            discussion={d}
            onTag={onParam}
            sectionName={d.sectionId ? sectionNames.get(d.sectionId) : undefined}
          />
        ))}
      </div>
      {totalPages > 1 && (
        <nav className="flex items-center justify-between py-5 font-mono text-2xs text-ink-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onParam('page', String(page - 1))}
            className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← 上一页
          </button>
          <span className="tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onParam('page', String(page + 1))}
            className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed"
          >
            下一页 →
          </button>
        </nav>
      )}
    </>
  );
}
