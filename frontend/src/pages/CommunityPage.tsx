import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Pin, Plus, Search, X } from 'lucide-react';
import { Badge, Button, Input, Spinner, Textarea, useToast } from '@/components/ui';
import { createDiscussion, listDiscussions } from '@/api/discussion';
import { getCommunityMeta } from '@/api/community';
import { ApiClientError } from '@/api/client';
import { useAuthStore } from '@/stores/auth';
import { formatNumber, relativeTime } from '@/lib/utils';
import type { CommunityVisibility, Discussion } from '@/types';
import { cn } from '@/lib/utils';

const VISIBILITY_LABEL: Record<CommunityVisibility, string> = {
  public: '公开可见',
  members: '成员可见',
  restricted: '授权可见',
};

type Sort = 'last_reply' | 'newest' | 'oldest';

function splitTags(tags: string): string[] {
  return tags ? tags.split(/[,\s]+/).filter(Boolean) : [];
}

export function CommunityPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [composerOpen, setComposerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '');

  const sortParam = params.get('sort');
  const sort: Sort =
    sortParam === 'newest' || sortParam === 'oldest' ? sortParam : 'last_reply';
  const tag = params.get('tag') ?? '';
  const q = params.get('q') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);

  useEffect(() => {
    setSearchDraft(q);
  }, [q]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next);
  };

  const metaQ = useQuery({
    queryKey: ['community-meta'],
    queryFn: getCommunityMeta,
    staleTime: 30_000,
  });
  const listQ = useQuery({
    queryKey: ['community-topics', page, sort, tag, q],
    queryFn: () =>
      listDiscussions(
        { scope: 'community' },
        { page, pageSize: 20, sort, tag: tag || undefined, q: q || undefined },
      ),
    enabled: !!metaQ.data?.canView,
    staleTime: 15_000,
  });

  const createMut = useMutation({
    mutationFn: () =>
      createDiscussion({ scope: 'community' }, content.trim(), undefined, title.trim()),
    onSuccess: (d) => {
      setTitle('');
      setContent('');
      setComposerOpen(false);
      qc.invalidateQueries({ queryKey: ['community-topics'] });
      qc.invalidateQueries({ queryKey: ['community-meta'] });
      toast.success('主题已发布');
      navigate(`/community/${d.id}`);
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '发布失败'),
  });

  const topics = listQ.data?.items ?? [];
  const total = listQ.data?.total ?? 0;
  const pageSize = listQ.data?.pageSize ?? 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of topics) {
      for (const name of splitTags(t.tags)) {
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [topics]);

  if (metaQ.isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (metaQ.isError || !metaQ.data) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">社区暂不可用</h1>
          <p className="mt-2 text-ink-3">请稍后重试。</p>
        </div>
      </div>
    );
  }

  const meta = metaQ.data;

  if (!meta.canView) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <header className="border-t-2 border-ink pt-6 mb-8">
          <p className="font-mono text-2xs text-ink-3 mb-3">$ community --index</p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
            社区
          </h1>
        </header>
        <div className="border border-rule bg-paper-2/40 p-6">
          <div className="flex items-center gap-2 text-ink">
            <Lock className="h-4 w-4 text-ink-3" />
            <h2 className="text-sm font-medium">社区讨论仅对指定成员开放</h2>
          </div>
          <p className="mt-2 text-sm text-ink-3">
            {meta.visibility === 'members'
              ? '登录后即可查看和参与讨论。'
              : '需要社区访问授权。请联系管理员。'}
          </p>
          {!user && (
            <Link to="/auth/login?redirect=%2Fcommunity" className="mt-4 inline-block text-sm text-amber">
              登录
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ community --index</p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
              社区
            </h1>
            <p className="mt-2 text-ink-2 max-w-prose">
              技术讨论、Writeup 思路与赛事交流。主题与回复均使用 Markdown。
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={meta.visibility === 'public' ? 'success' : 'neutral'}>
              {VISIBILITY_LABEL[meta.visibility]}
            </Badge>
            <Badge tone={meta.posting === 'restricted' ? 'warning' : 'neutral'}>
              {meta.posting === 'restricted' ? '授权可发帖' : '成员可发帖'}
            </Badge>
          </div>
        </div>
      </header>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_15rem] gap-8 lg:gap-10 items-start">
        <main className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-rule pb-3">
            <form
              className="flex items-center gap-2 flex-1 min-w-[14rem]"
              onSubmit={(e) => {
                e.preventDefault();
                setParam('q', searchDraft.trim());
              }}
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-3" />
                <Input
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  placeholder="搜索标题或内容"
                  className="h-8 pl-8 text-xs"
                  aria-label="搜索社区主题"
                />
              </div>
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchDraft('');
                    setParam('q', '');
                  }}
                  className="text-ink-3 hover:text-ink"
                  aria-label="清除搜索"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </form>
            {meta.canPost && (
              <Button
                type="button"
                size="sm"
                variant={composerOpen ? 'ghost' : 'primary'}
                onClick={() => setComposerOpen((v) => !v)}
              >
                <Plus className="h-3.5 w-3.5" />
                发起讨论
              </Button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1 border-b border-rule py-2">
            {(
              [
                ['last_reply', '最近回复'],
                ['newest', '最新发布'],
                ['oldest', '最早发布'],
              ] as [Sort, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setParam('sort', value === 'last_reply' ? '' : value)}
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
                onClick={() => setParam('tag', '')}
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

          {composerOpen && meta.canPost && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!title.trim() || !content.trim() || createMut.isPending) return;
                createMut.mutate();
              }}
              className="border border-rule bg-paper-2/30 p-4 my-4 space-y-3"
            >
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="主题标题"
                maxLength={160}
                aria-label="主题标题"
              />
              <Textarea
                rows={5}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="描述你的问题、思路或发现。支持 Markdown。"
              />
              <div className="flex items-center justify-between gap-3">
                <span className="text-2xs text-ink-3">标题必填；正文最长 5000 字符。</span>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setComposerOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    loading={createMut.isPending}
                    disabled={!title.trim() || !content.trim()}
                  >
                    发布主题
                  </Button>
                </div>
              </div>
            </form>
          )}

          {listQ.isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Spinner className="h-5 w-5 text-ink-3" />
            </div>
          ) : listQ.isError ? (
            <p className="py-12 text-sm text-ink-3">无法加载社区主题。</p>
          ) : topics.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-sm text-ink-3">
                {q || tag ? '没有匹配的主题。' : '还没有主题。发布第一个话题吧。'}
              </p>
              {(q || tag) && (
                <button
                  type="button"
                  onClick={() => setParams(new URLSearchParams())}
                  className="mt-3 text-sm text-amber"
                >
                  清除筛选
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] gap-4 border-b border-rule-strong px-3 py-2 font-mono text-2xs text-ink-3">
                <span>主题</span>
                <span className="text-right">回复</span>
                <span className="text-right">浏览</span>
              </div>
              <div className="border-b border-rule">
                {topics.map((d) => (
                  <TopicRow key={d.id} discussion={d} onTag={setParam} />
                ))}
              </div>
            </>
          )}

          {totalPages > 1 && (
            <nav className="flex items-center justify-between py-5 font-mono text-2xs text-ink-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setParam('page', String(page - 1))}
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
                onClick={() => setParam('page', String(page + 1))}
                className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed"
              >
                下一页 →
              </button>
            </nav>
          )}
        </main>

        <aside className="space-y-6 lg:border-l lg:border-rule lg:pl-6">
          <section>
            <h2 className="font-mono text-2xs text-ink-3 mb-2">发帖须知</h2>
            <p className="text-xs leading-relaxed text-ink-2">
              讨论技术问题、Writeup 思路与赛事交流。请勿直接张贴 flag 或完整答案，引用他人内容时注明来源。
            </p>
          </section>
          <section>
            <h2 className="font-mono text-2xs text-ink-3 mb-2">当前策略</h2>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={meta.visibility === 'public' ? 'success' : 'neutral'}>
                {VISIBILITY_LABEL[meta.visibility]}
              </Badge>
              <Badge tone={meta.posting === 'restricted' ? 'warning' : 'neutral'}>
                {meta.posting === 'restricted' ? '授权可发帖' : '成员可发帖'}
              </Badge>
            </div>
          </section>
          {tagCounts.length > 0 && (
            <section>
              <h2 className="font-mono text-2xs text-ink-3 mb-2">本页标签</h2>
              <div className="flex flex-wrap gap-1.5">
                {tagCounts.map(([name, count]) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setParam('tag', name === tag ? '' : name)}
                    className={cn(
                      'inline-flex items-center gap-1 px-1.5 py-0.5 border rounded-sm font-mono text-2xs transition-colors',
                      name === tag
                        ? 'border-amber text-amber'
                        : 'border-rule text-ink-3 hover:border-rule-strong hover:text-ink',
                    )}
                  >
                    #{name}
                    <span className="tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function TopicRow({
  discussion: d,
  onTag,
}: {
  discussion: Discussion;
  onTag: (key: string, value: string) => void;
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
