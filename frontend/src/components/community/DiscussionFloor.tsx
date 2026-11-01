import { Link } from 'react-router-dom';
import { Heart, Lock, Pin, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { Markdown } from '@/components/Markdown';
import { cn, relativeTime } from '@/lib/utils';
import type { Discussion } from '@/types';

export function DiscussionFloor({
  post,
  floor,
  isTopic = false,
  topicAuthorId,
  canDelete,
  canReply,
  onLike,
  onReply,
  onDelete,
}: {
  post: Discussion;
  floor: number;
  isTopic?: boolean;
  topicAuthorId: number;
  canDelete: boolean;
  canReply: boolean;
  onLike: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const isOp = post.userId === topicAuthorId;
  return (
    <article className="grid grid-cols-[2.5rem_minmax(0,1fr)] sm:grid-cols-[3.5rem_minmax(0,1fr)] gap-3 sm:gap-5 border-b border-rule py-5">
      <div className="pt-0.5 font-mono text-2xs text-ink-3 tabular-nums">#{floor}</div>
      <div className="min-w-0">
        <header className="mb-2 flex flex-wrap items-center gap-2">
          <Avatar name={post.user?.username ?? '?'} />
          <Link to={`/users/${post.userId}`} className="text-sm font-medium hover:text-amber">
            {post.user?.username ?? `#${post.userId}`}
          </Link>
          {isOp && <Badge tone="warning">楼主</Badge>}
          <span className="font-mono text-2xs text-ink-3">{relativeTime(post.createdAt)}</span>
          {post.editCount > 0 && (
            <span className="font-mono text-2xs text-ink-3">
              已编辑 · 修改于 {relativeTime(post.editedAt ?? post.updatedAt)}
            </span>
          )}
          {isTopic && post.isPinned && <Pin className="h-3 w-3 text-amber" aria-label="置顶" />}
          {isTopic && post.isLocked && <Lock className="h-3 w-3 text-ink-3" aria-label="已锁定" />}
        </header>
        <Markdown>{post.contentMd}</Markdown>
        <footer className="mt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={onLike}
            className={cn(
              'inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm transition-colors hover:bg-paper-2',
              post.liked ? 'text-amber' : 'text-ink-3',
            )}
          >
            <Heart className={cn('h-3 w-3', post.liked && 'fill-current')} />
            {post.likeCount > 0 ? post.likeCount : '赞'}
          </button>
          {canReply && (
            <button
              type="button"
              onClick={onReply}
              className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm text-ink-3 hover:bg-paper-2 transition-colors"
            >
              回复
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm text-ink-3 hover:bg-paper-2 hover:text-oxblood transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              删除
            </button>
          )}
        </footer>
      </div>
    </article>
  );
}
