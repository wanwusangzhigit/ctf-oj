import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Heart, Lock, Pin, Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Input,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { Markdown } from '@/components/Markdown';
import {
  createDiscussion,
  deleteDiscussion,
  getCommunityDiscussion,
  moderateDiscussion,
  toggleDiscussionLike,
} from '@/api/discussion';
import { getCommunityMeta } from '@/api/community';
import { ApiClientError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { formatNumber, relativeTime } from '@/lib/utils';
import type { Discussion } from '@/types';
import { cn } from '@/lib/utils';

function splitTags(tags: string): string[] {
  return tags ? tags.split(/[,\s]+/).filter(Boolean) : [];
}

export function CommunityTopicPage() {
  const { id } = useParams<{ id: string }>();
  const topicId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const metaQ = useQuery({
    queryKey: ['community-meta'],
    queryFn: getCommunityMeta,
    staleTime: 30_000,
  });
  const topicQ = useQuery({
    queryKey: ['community-topic', topicId],
    queryFn: () => getCommunityDiscussion(topicId),
    enabled: Number.isFinite(topicId) && topicId > 0 && !!metaQ.data?.canView,
    staleTime: 10_000,
  });
  const topic = topicQ.data;

  useEffect(() => {
    if (topic) setTagDraft(topic.tags ?? '');
  }, [topic]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['community-topic', topicId] });
    qc.invalidateQueries({ queryKey: ['community-topics'] });
  };

  const replyMut = useMutation({
    mutationFn: () => createDiscussion({ scope: 'community' }, draft.trim(), topicId),
    onSuccess: () => {
      setDraft('');
      setQuote(null);
      invalidate();
      toast.success('已回复');
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '回复失败'),
  });

  const likeMut = useMutation({
    mutationFn: (discussionId: number) => toggleDiscussionLike(discussionId),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (discussionId: number) => deleteDiscussion(discussionId),
    onSuccess: (_data, discussionId) => {
      if (discussionId === topicId) {
        qc.invalidateQueries({ queryKey: ['community-topics'] });
        toast.success('主题已删除');
        navigate('/community');
        return;
      }
      invalidate();
      toast.success('回复已删除');
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  const modMut = useMutation({
    mutationFn: (input: { isPinned?: boolean; isLocked?: boolean; tags?: string }) =>
      moderateDiscussion({ scope: 'community' }, topicId, input),
    onSuccess: invalidate,
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const startReply = (username: string) => {
    setQuote(username);
    setDraft((prev) => (prev.trim() ? prev : `> @${username} \n\n`));
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  if (metaQ.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (!metaQ.data?.canView) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回社区
        </Link>
        <div className="mt-8 border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">无法查看该主题</h1>
          <p className="mt-2 text-ink-3">该主题可能仅对社区成员或授权对象开放。</p>
        </div>
      </div>
    );
  }

  if (topicQ.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (topicQ.isError || !topic) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <Link to="/community" className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink">
          <ArrowLeft className="h-3.5 w-3.5" />
          返回社区
        </Link>
        <div className="mt-8 border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">主题不存在</h1>
          <p className="mt-2 text-ink-3">该主题可能已被删除。</p>
        </div>
      </div>
    );
  }

  const meta = metaQ.data;
  const tags = splitTags(topic.tags);
  const canDeleteTopic = !!user && (user.id === topic.userId || meta.canModerate);
  const canReply = meta.canPost && !topic.isLocked;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to="/community"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink mb-6"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回社区
      </Link>

      <header className="border-t-2 border-ink pt-6">
        <div className="flex flex-wrap items-center gap-2 font-mono text-2xs text-ink-3">
          <span>主题 #{topic.id}</span>
          <span aria-hidden>·</span>
          <span>{formatNumber(topic.viewCount)} 浏览</span>
          <span aria-hidden>·</span>
          <span>{formatNumber(topic.replyCount)} 回复</span>
          {topic.isPinned && (
            <span className="inline-flex items-center gap-1 text-amber">
              <Pin className="h-3 w-3" />
              置顶
            </span>
          )}
          {topic.isLocked && (
            <span className="inline-flex items-center gap-1">
              <Lock className="h-3 w-3" />
              已锁定
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tightest text-ink leading-[1.15] break-words">
          {topic.title || '社区主题'}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {tags.map((name) => (
            <Link
              key={name}
              to={`/community?tag=${encodeURIComponent(name)}`}
              className="font-mono text-2xs text-ink-3 border border-rule rounded-sm px-1.5 py-0.5 hover:border-amber hover:text-amber"
            >
              #{name}
            </Link>
          ))}
        </div>

        {meta.canModerate && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => modMut.mutate({ isPinned: !topic.isPinned })}
            >
              <Pin className="h-3 w-3" />
              {topic.isPinned ? '取消置顶' : '置顶'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => modMut.mutate({ isLocked: !topic.isLocked })}
            >
              <Lock className="h-3 w-3" />
              {topic.isLocked ? '解锁' : '锁定'}
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="font-mono text-2xs text-ink-3">标签</span>
              <Input
                value={tagDraft}
                onChange={(e) => setTagDraft(e.target.value)}
                onBlur={() => {
                  if (tagDraft !== (topic.tags ?? '')) modMut.mutate({ tags: tagDraft });
                }}
                placeholder="逗号分隔"
                className="h-7 w-40 text-2xs"
                aria-label="主题标签"
              />
            </div>
          </div>
        )}
      </header>

      <Floor
        post={topic}
        floor={1}
        isTopic
        topicAuthorId={topic.userId}
        canDelete={canDeleteTopic}
        canReply={canReply}
        onLike={() => likeMut.mutate(topic.id)}
        onReply={() => startReply(topic.user?.username ?? '')}
        onDelete={() => {
          if (confirm('确认删除这个主题及其全部回复？')) deleteMut.mutate(topic.id);
        }}
      />

      {(topic.replies ?? []).length > 0 ? (
        (topic.replies ?? []).map((reply, index) => (
          <Floor
            key={reply.id}
            post={reply}
            floor={index + 2}
            topicAuthorId={topic.userId}
            canDelete={!!user && (user.id === reply.userId || meta.canModerate)}
            canReply={canReply}
            onLike={() => likeMut.mutate(reply.id)}
            onReply={() => startReply(reply.user?.username ?? '')}
            onDelete={() => {
              if (confirm('确认删除这条回复？')) deleteMut.mutate(reply.id);
            }}
          />
        ))
      ) : (
        <p className="border-b border-rule py-8 text-sm text-ink-3">还没有回复。</p>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium text-ink mb-3">回复主题</h2>
        {topic.isLocked ? (
          <p className="text-sm text-ink-3">主题已锁定，暂时无法回复。</p>
        ) : meta.canPost ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim() || replyMut.isPending) return;
              replyMut.mutate();
            }}
            className="space-y-2"
          >
            {quote && (
              <div className="flex items-center gap-2 text-2xs text-ink-3">
                正在回复 @{quote}
                <button
                  type="button"
                  onClick={() => {
                    setQuote(null);
                    setDraft('');
                  }}
                  className="text-amber"
                >
                  取消
                </button>
              </div>
            )}
            <Textarea
              ref={textareaRef}
              rows={5}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="写下你的回复。支持 Markdown。"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xs text-ink-3">回复将以楼层形式追加。</span>
              <Button type="submit" size="sm" loading={replyMut.isPending} disabled={!draft.trim()}>
                发布回复
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-ink-3">
            {user ? '当前仅授权成员可回复。' : '登录后即可回复。'}
          </p>
        )}
      </section>
    </div>
  );
}

function Floor({
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
