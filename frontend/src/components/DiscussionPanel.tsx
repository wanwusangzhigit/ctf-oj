import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart, MessageSquare, Trash2, CornerDownRight } from 'lucide-react';
import {
  Button,
  Card,
  CardBody,
  Spinner,
  Textarea,
  useToast,
} from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { Markdown } from '@/components/Markdown';
import {
  createDiscussion,
  deleteDiscussion,
  listDiscussions,
  toggleDiscussionLike,
} from '@/api/discussion';
import { relativeTime } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';
import { ApiClientError } from '@/api/client';
import type { Discussion } from '@/types';
import { cn } from '@/lib/utils';

export function DiscussionPanel({ challengeId }: { challengeId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState('');

  const list = useQuery({
    queryKey: ['discussions', challengeId],
    queryFn: () => listDiscussions(challengeId, 1, 50),
    staleTime: 15_000,
  });

  const submitMut = useMutation({
    mutationFn: (content: string) => createDiscussion(challengeId, content),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['discussions', challengeId] });
      toast.success('已发布');
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '发布失败'),
  });

  return (
    <Card>
      <CardBody className="space-y-5">
        <h3 className="text-base font-semibold">讨论</h3>

        {user ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = draft.trim();
              if (!t) return;
              submitMut.mutate(t);
            }}
            className="space-y-2"
          >
            <Textarea
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="使用 Markdown 表达你的想法。"
            />
            <div className="flex items-center justify-between">
              <span className="text-2xs text-muted">
                支持 GFM；最长 5000 字符；尊重他人。
              </span>
              <Button type="submit" size="sm" loading={submitMut.isPending} disabled={!draft.trim()}>
                发布
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-muted">登录后即可参与讨论。</p>
        )}

        <div className="space-y-4">
          {list.isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Spinner className="h-5 w-5 text-muted" />
            </div>
          ) : list.data?.items?.length ? (
            list.data.items.map((d) => (
              <CommentItem key={d.id} challengeId={challengeId} discussion={d} />
            ))
          ) : (
            <p className="text-sm text-muted">还没有讨论。来发第一条吧。</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function CommentItem({
  challengeId,
  discussion,
  isReply = false,
}: {
  challengeId: number;
  discussion: Discussion;
  isReply?: boolean;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyDraft, setReplyDraft] = useState('');

  const likeMut = useMutation({
    mutationFn: () => toggleDiscussionLike(discussion.id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['discussions', challengeId] });
      void res;
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  const replyMut = useMutation({
    mutationFn: (content: string) => createDiscussion(challengeId, content, discussion.id),
    onSuccess: () => {
      setReplyOpen(false);
      setReplyDraft('');
      qc.invalidateQueries({ queryKey: ['discussions', challengeId] });
      toast.success('已回复');
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '回复失败'),
  });

  const delMut = useMutation({
    mutationFn: () => deleteDiscussion(discussion.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discussions', challengeId] });
      toast.success('已删除');
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  const canDelete = user && (user.id === discussion.userId || user.role === 'admin');

  return (
    <div className={cn('space-y-2', isReply && 'ml-8 border-l border-border pl-4')}>
      <div className="flex items-start gap-3">
        <Avatar name={discussion.user?.username ?? '?'} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm">{discussion.user?.username ?? '未知'}</span>
            <span className="text-2xs text-muted">{relativeTime(discussion.createdAt)}</span>
          </div>
          <Markdown>{discussion.contentMd}</Markdown>
          <div className="flex items-center gap-1 mt-2">
            <button
              type="button"
              onClick={() => likeMut.mutate()}
              className={cn(
                'inline-flex items-center gap-1 h-7 px-2 text-2xs rounded transition-colors hover:bg-surface-2',
                discussion.liked ? 'text-accent' : 'text-muted',
              )}
            >
              <Heart className={cn('h-3 w-3', discussion.liked && 'fill-current')} />
              {discussion.likeCount > 0 ? discussion.likeCount : '赞'}
            </button>
            {!isReply && user && (
              <button
                type="button"
                onClick={() => setReplyOpen((v) => !v)}
                className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded text-muted hover:bg-surface-2 transition-colors"
              >
                <MessageSquare className="h-3 w-3" />
                回复
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('确认删除这条评论？')) delMut.mutate();
                }}
                className="inline-flex items-center gap-1 h-7 px-2 text-2xs rounded text-muted hover:bg-surface-2 hover:text-danger transition-colors"
              >
                <Trash2 className="h-3 w-3" />
                删除
              </button>
            )}
          </div>
        </div>
      </div>

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
              取消
            </Button>
            <Button type="submit" size="sm" loading={replyMut.isPending} disabled={!replyDraft.trim()}>
              <CornerDownRight className="h-3 w-3" />
              回复
            </Button>
          </div>
        </form>
      )}

      {discussion.replies && discussion.replies.length > 0 && (
        <div className="space-y-3 pt-2">
          {discussion.replies.map((r) => (
            <CommentItem key={r.id} challengeId={challengeId} discussion={r} isReply />
          ))}
        </div>
      )}
    </div>
  );
}
