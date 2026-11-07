import { Link } from 'react-router-dom';
import { Lock, Pin } from 'lucide-react';
import { cn, formatNumber, relativeTime } from '@/lib/utils';
import type { Discussion } from '@/types';

export function splitTags(tags: string): string[] {
  return tags ? tags.split(/[,\s]+/).filter(Boolean) : [];
}

export function TopicRow({
  discussion: d,
  onTag,
  sectionName,
}: {
  discussion: Discussion;
  onTag: (key: string, value: string) => void;
  sectionName?: string;
}) {
  const tags = splitTags(d.tags);
  const href = `/community/${d.id}`;
  return (
    <div
      className={cn(
        'group grid sm:grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-2 sm:gap-4 px-3 py-3 border-b border-rule last:border-b-0 hover:bg-paper-2/60 transition-colors',
        d.isPinned && 'border-l-2 border-l-amber',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          {d.isPinned && <Pin className="h-3 w-3 shrink-0 text-amber" aria-label="置顶" />}
          <Link
            to={href}
            className="truncate text-sm font-medium text-ink group-hover:text-amber hover:no-underline"
          >
            {d.title || '(无标题)'}
          </Link>
          {d.isLocked && <Lock className="h-3 w-3 shrink-0 text-ink-3" aria-label="已锁定" />}
          {sectionName && d.sectionId && (
            <Link
              to={`/community?section=${d.sectionId}`}
              className="hidden md:inline font-mono text-2xs text-ink-3 border border-rule rounded-sm px-1 py-0.5 hover:border-amber hover:text-amber hover:no-underline"
            >
              {sectionName}
            </Link>
          )}
          {tags.slice(0, 3).map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => onTag('tag', name)}
              className="hidden md:inline font-mono text-2xs text-ink-3 border border-rule rounded-sm px-1 py-0.5 hover:border-amber hover:text-amber"
            >
              #{name}
            </button>
          ))}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-2xs text-ink-3">
          <Link to={`/users/${d.userId}`} className="hover:text-amber">
            {d.user?.username ?? `#${d.userId}`}
          </Link>
          <span aria-hidden>·</span>
          <span>发布于 {relativeTime(d.createdAt)}</span>
          <span aria-hidden>·</span>
          <span>最后回复 {relativeTime(d.lastReplyAt ?? d.createdAt)}</span>
          {d.editCount > 0 && (
            <>
              <span aria-hidden>·</span>
              <span>已编辑 {d.editCount} 次</span>
            </>
          )}
        </div>
      </div>
      <Link
        to={href}
        className="flex sm:block items-center gap-3 font-mono text-2xs text-ink-3 tabular-nums sm:text-right hover:no-underline hover:text-ink"
      >
        <span className="sm:hidden">回复 {d.replyCount}</span>
        <span className="hidden sm:block">{formatNumber(d.replyCount)}</span>
        <span className="sm:hidden">浏览 {d.viewCount}</span>
        <span className="hidden sm:block">{formatNumber(d.viewCount)}</span>
      </Link>
    </div>
  );
}
