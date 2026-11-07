import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Pencil, Pin, Lock } from 'lucide-react';
import { Button, Input, Spinner, useConfirm, useToast } from '@/components/ui';
import { DiscussionFloor } from '@/components/community/DiscussionFloor';
import { ReplyForm } from '@/components/community/ReplyForm';
import {
  createDiscussion,
  deleteDiscussion,
  getCommunityDiscussion,
  moderateDiscussion,
  toggleDiscussionLike,
} from '@/api/discussion';
import { ApiClientError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { formatNumber, relativeTime } from '@/lib/utils';
import { splitTags } from '@/components/community/TopicRow';
import { useCommunityOutlet } from './CommunityLayout';

export function CommunityTopicPage() {
  const { id } = useParams<{ id: string }>();
  const topicId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const user = useAuthStore((s) => s.user);
  const { meta, copy, sections } = useCommunityOutlet();
  const [draft, setDraft] = useState('');
  const [quote, setQuote] = useState<string | null>(null);
  const [tagDraft, setTagDraft] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const topicQ = useQuery({
    queryKey: ['community-topic', topicId],
    queryFn: () => getCommunityDiscussion(topicId),
    enabled: Number.isFinite(topicId) && topicId > 0,
    staleTime: 10_000,
  });
  const topic = topicQ.data;

  useEffect(() => {
    if (topic) setTagDraft(topic.tags ?? '');
  }, [topic]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['community-topic', topicId] });
    qc.invalidateQueries({ queryKey: ['community-topics'] });
    qc.invalidateQueries({ queryKey: ['discussion-content', topicId] });
    qc.invalidateQueries({ queryKey: ['discussion-revisions', topicId] });
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

  if (topicQ.isLoading) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (topicQ.isError || !topic) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">主题不存在</h1>
          <p className="mt-2 text-ink-3">该主题可能已被删除。</p>
          <Link to="/community" className="mt-4 inline-block text-sm text-amber">
            返回{copy.title}
          </Link>
        </div>
      </div>
    );
  }

  const tags = splitTags(topic.tags);
  const section = sections.find((s) => s.id === topic.sectionId);
  const isAuthor = !!user && user.id === topic.userId;
  // Board grants cover this topic's own board, so they widen moderation and
  // replying but nothing station-wide.
  const canModerateHere = meta.canModerate || !!section?.canManage;
  const canPostHere = meta.canPost || !!section?.canPost;
  const canDeleteTopic = isAuthor || canModerateHere;
  const canReply = canPostHere && !topic.isLocked;
  // A locked topic stops its author editing, not a moderator: locking is the
  // tool used against the author, so it must not make the topic uncorrectable.
  const canEdit = canModerateHere || (isAuthor && !topic.isLocked);
  const canViewHistory = canModerateHere || isAuthor;

  return (
    <div className="max-w-3xl mx-auto">
      <header className="border-t-2 border-ink pt-6">
        <div className="flex flex-wrap items-center gap-2 font-mono text-2xs text-ink-3">
          <span>主题 #{topic.id}</span>
          {section && (
            <Link
              to={`/community?section=${section.id}`}
              className="border border-rule rounded-sm px-1.5 py-0.5 hover:border-amber hover:text-amber hover:no-underline"
            >
              {section.name}
            </Link>
          )}
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
          {topic.editCount > 0 && (
            <span>
              已编辑 {topic.editCount} 次 · 修改于 {relativeTime(topic.editedAt ?? topic.updatedAt)}
            </span>
          )}
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tightest text-ink leading-[1.15] break-words">
          {topic.title || copy.topic_fallback_title}
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

        {(canEdit || canViewHistory) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-3">
            {canEdit && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/community/${topicId}/edit`)}
              >
                <Pencil className="h-3 w-3" />
                编辑
              </Button>
            )}
            {canViewHistory && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/community/${topicId}/history`)}
              >
                <History className="h-3 w-3" />
                {copy.history_title}
              </Button>
            )}
            {canModerateHere && (
              <>
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
              </>
            )}
          </div>
        )}
      </header>

      <DiscussionFloor
        post={topic}
        floor={1}
        isTopic
        topicAuthorId={topic.userId}
        canDelete={canDeleteTopic}
        canReply={canReply}
        onLike={() => likeMut.mutate(topic.id)}
        onReply={() => startReply(topic.user?.username ?? '')}
        onDelete={async () => {
          const ok = await confirm({
            title: '删除主题',
            description: '该主题及其全部回复都会被删除，无法恢复。',
            confirmText: '删除',
          });
          if (ok) deleteMut.mutate(topic.id);
        }}
      />

      {(topic.replies ?? []).length > 0 ? (
        (topic.replies ?? []).map((reply, index) => (
          <DiscussionFloor
            key={reply.id}
            post={reply}
            floor={index + 2}
            topicAuthorId={topic.userId}
            canDelete={!!user && (user.id === reply.userId || canModerateHere)}
            canReply={canReply}
            onLike={() => likeMut.mutate(reply.id)}
            onReply={() => startReply(reply.user?.username ?? '')}
            onDelete={async () => {
              const ok = await confirm({
                title: '删除回复',
                description: '该回复会被删除，后续楼层序号会重新排列。',
                confirmText: '删除',
              });
              if (ok) deleteMut.mutate(reply.id);
            }}
          />
        ))
      ) : (
        <p className="border-b border-rule py-8 text-sm text-ink-3">{copy.no_replies}</p>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-medium text-ink mb-3">回复主题</h2>
        {topic.isLocked ? (
          <p className="text-sm text-ink-3">{copy.locked_notice}</p>
        ) : canPostHere ? (
          <ReplyForm
            copy={copy}
            draft={draft}
            quote={quote}
            pending={replyMut.isPending}
            textareaRef={textareaRef}
            onChange={setDraft}
            onCancelQuote={() => {
              setQuote(null);
              setDraft('');
            }}
            onSubmit={() => replyMut.mutate()}
          />
        ) : (
          <p className="text-sm text-ink-3">
            {user ? copy.reply_denied_member : copy.reply_denied_guest}
          </p>
        )}
      </section>
    </div>
  );
}
