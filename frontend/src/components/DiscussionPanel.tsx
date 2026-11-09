import i18n from '@/locales/i18n';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, Trash2, CornerDownRight, Pin, Lock } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  Input,
  Spinner,
  Textarea,
  useConfirm,
  useToast,
} from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { Markdown } from '@/components/Markdown';
import {
  createDiscussion,
  deleteDiscussion,
  listDiscussions,
  moderateDiscussion,
  toggleDiscussionLike,
  type DiscussionTarget,
} from '@/api/discussion';
import { relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { hasPermission } from '@/lib/permissions';
import { ApiClientError } from '@/api/client';
import type { Discussion } from '@/types';
import { cn } from '@/lib/utils';

function queryKey(target: DiscussionTarget) {
  return [
    'discussions',
    target.scope,
    target.id ?? 0,
    target.competitionId ?? 0,
  ] as const;
}

export function DiscussionPanel({
  target,
  title = i18n.t('讨论'),
  canPost,
  canModerate,
  emptyText = i18n.t('还没有讨论。来发第一条吧。'),
  postDeniedText = i18n.t('当前仅授权成员可发帖。'),
}: {
  target: DiscussionTarget;
  title?: string;
  canPost?: boolean;
  canModerate?: boolean;
  emptyText?: string;
  postDeniedText?: string;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const isTopicScope = target.scope === 'community' || target.scope === 'competition';
  const allowPost = canPost ?? !!user;
  const allowModerate = canModerate ?? hasPermission(user, 'discussion.moderate');

  const list = useQuery({
    queryKey: queryKey(target),
    queryFn: () => listDiscussions(target, { page: 1, pageSize: 50 }),
    staleTime: 15_000,
  });

  const submitMut = useMutation({
    mutationFn: () =>
      createDiscussion(
        target,
        draft.trim(),
        undefined,
        isTopicScope ? titleDraft.trim() : undefined,
      ),
    onSuccess: () => {
      setDraft('');
      setTitleDraft('');
      qc.invalidateQueries({ queryKey: queryKey(target) });
      toast.success(i18n.t('已发布'));
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('发布失败')),
  });

  const submitDisabled =
    !draft.trim() || (isTopicScope && !titleDraft.trim()) || submitMut.isPending;

  return (
    <Card>
      <CardBody className="space-y-5">
        <h3 className="text-base font-semibold">{title}</h3>

        {user && allowPost ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (submitDisabled) return;
              submitMut.mutate();
            }}
            className="space-y-2"
          >
            {isTopicScope && (
              <Input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                placeholder={i18n.t('主题标题')}
                maxLength={160}
                aria-label={i18n.t('主题标题')}
              />
            )}
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={i18n.t('使用 Markdown 表达你的想法。')}
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-2xs text-ink-3">
                {i18n.t('支持 GFM；最长 5000 字符；尊重他人。')}
              </span>
              <Button type="submit" size="sm" loading={submitMut.isPending} disabled={submitDisabled}>
                {i18n.t('发布')}
              </Button>
            </div>
          </form>
        ) : user ? (
          <p className="text-sm text-ink-3">{postDeniedText}</p>
        ) : (
          <p className="text-sm text-ink-3">{i18n.t('登录后即可参与讨论。')}</p>
        )}

        <div className="space-y-4">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner className="h-5 w-5 text-ink-3" />
            </div>
          ) : list.data?.items?.length ? (
            list.data.items.map((d) => (
              <CommentItem
                key={d.id}
                target={target}
                discussion={d}
                canPost={allowPost}
                canModerate={allowModerate}
              />
            ))
          ) : (
            <p className="text-sm text-ink-3">{emptyText}</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function CommentItem({
  target,
  discussion,
  canPost,
  canModerate,
  isReply = false,
}: {
  target: DiscussionTarget;
  discussion: Discussion;
  canPost: boolean;
  canModerate: boolean;
  isReply?: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAuthStore((s) => s.user);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');
  const [tagDraft, setTagDraft] = useState(discussion.tags ?? '');

  const invalidate = () => qc.invalidateQueries({ queryKey: queryKey(target) });

  const likeMut = useMutation({
    mutationFn: () => toggleDiscussionLike(discussion.id),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('操作失败')),
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => createDiscussion(target, content, discussion.id),
    onSuccess: () => {
      setReplyOpen(false);
      setReplyDraft('');
      invalidate();
      toast.success(i18n.t('已回复'));
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('回复失败')),
  });

  const delMut = useMutation({
    mutationFn: () => deleteDiscussion(discussion.id),
    onSuccess: () => {
      invalidate();
      toast.success(i18n.t('已删除'));
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('删除失败')),
  });

  const modMut = useMutation({
    mutationFn: (input: { isPinned?: boolean; isLocked?: boolean; tags?: string }) =>
      moderateDiscussion(target, discussion.id, input),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('操作失败')),
  });

  const canDelete = !!user && (user.id === discussion.userId || canModerate);
  const tags = discussion.tags ? discussion.tags.split(/[,\s]+/).filter(Boolean) : [];

  return (
    <div className={cn('space-y-2', isReply && 'ml-8 border-l border-rule pl-4')}>
      <div className="flex items-start gap-3">
        <Avatar name={discussion.user?.username ?? '?'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-sm">{discussion.user?.username ?? i18n.t('未知')}</span>
            <span className="text-2xs text-ink-3">{relativeTime(discussion.createdAt)}</span>
            {discussion.isPinned && (
              <span className="inline-flex items-center gap-1 font-mono text-2xs text-amber">
                <Pin className="h-3 w-3" />{i18n.t('置顶')}
              </span>
            )}
            {discussion.isLocked && (
              <span className="inline-flex items-center gap-1 font-mono text-2xs text-ink-3">
                <Lock className="h-3 w-3" />{i18n.t('已锁定')}
              </span>
            )}
            {tags.map((t) => (
              <span
                key={t}
                className="font-mono text-2xs px-1.5 py-0.5 border border-rule rounded-sm text-ink-3"
              >
                {t}
              </span>
            ))}
          </div>
          {!isReply && discussion.title && (
            <h4 className="text-sm font-semibold text-ink mb-1">{discussion.title}</h4>
          )}
          <Markdown>{discussion.contentMd}</Markdown>
          <div className="flex items-center gap-1 mt-2">
            <button
              type="button"
              onClick={() => likeMut.mutate()}
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm transition-colors hover:bg-paper-2',
                discussion.liked ? 'text-amber' : 'text-ink-3',
              )}
            >
              <Heart className={cn('h-3 w-3', discussion.liked && 'fill-current')} />
              {discussion.likeCount > 0 ? discussion.likeCount : i18n.t('赞')}
            </button>
            {!isReply && user && canPost && !discussion.isLocked && (
              <button
                type="button"
                onClick={() => setReplyOpen((v) => !v)}
                className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm text-ink-3 hover:bg-paper-2 transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                {i18n.t('回复')}
              </button>
            )}
            {canModerate && (
              <>
                <button
                  type="button"
                  onClick={() => modMut.mutate({ isPinned: !discussion.isPinned })}
                  className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm text-ink-3 hover:bg-paper-2 transition-colors"
                >
                  <Pin className="h-3 w-3" />
                  {discussion.isPinned ? i18n.t('取消置顶') : i18n.t('置顶')}
                </button>
                <button
                  type="button"
                  onClick={() => modMut.mutate({ isLocked: !discussion.isLocked })}
                  className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm text-ink-3 hover:bg-paper-2 transition-colors"
                >
                  <Lock className="h-3 w-3" />
                  {discussion.isLocked ? i18n.t('解锁') : i18n.t('锁定')}
                </button>
              </>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await confirm({
                    title: i18n.t('删除评论'),
                    description: i18n.t('该评论及其子回复都会被删除，无法恢复。'),
                    confirmText: i18n.t('删除'),
                  });
                  if (ok) delMut.mutate();
                }}
                className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded-sm text-ink-3 hover:bg-paper-2 hover:text-oxblood transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                {i18n.t('删除')}
              </button>
            )}
          </div>
        </div>
      </div>

      {canModerate && !isReply && (
        <div className="flex items-center gap-2 pl-11">
          <span className="font-mono text-2xs text-ink-3">{i18n.t('标签')}</span>
          <input
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onBlur={() => {
              if (tagDraft !== (discussion.tags ?? '')) modMut.mutate({ tags: tagDraft });
            }}
            placeholder={i18n.t('逗号分隔')}
            className="h-7 px-2 text-2xs bg-paper border border-rule rounded-sm w-48"
          />
        </div>
      )}

      {replyOpen && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const t = replyDraft.trim();
            if (!t) return;
            replyMut.mutate(t);
          }}
          className="space-y-2"
        >
          <Textarea
            rows={2}
            value={replyDraft}
            onChange={(e) => setReplyDraft(e.target.value)}
            placeholder={`@${discussion.user?.username ?? ''} ...`}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setReplyOpen(false);
                setReplyDraft('');
              }}
            >
              {i18n.t('取消')}
            </Button>
            <Button type="submit" size="sm" loading={replyMut.isPending} disabled={!replyDraft.trim()}>
              <CornerDownRight className="h-3 w-3" />
              {i18n.t('回复')}
            </Button>
          </div>
        </form>
      )}

      {discussion.replies && discussion.replies.length > 0 && (
        <div className="space-y-3 pt-2">
          {discussion.replies.map((r) => (
            <CommentItem
              key={r.id}
              target={target}
              discussion={r}
              canPost={canPost}
              canModerate={canModerate}
              isReply
            />
          ))}
        </div>
      )}
    </div>
  );
}
