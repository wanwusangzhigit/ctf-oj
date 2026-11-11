import i18n from '@/locales/i18n';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { listDiscussionRevisions } from '@/api/discussion';
import { ApiClientError } from '@/api/client';
import { relativeTime } from '@/lib/utils';
import { useCommunityOutlet } from './CommunityLayout';

const PAGE_SIZE = 20;

export function CommunityHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const topicId = Number(id);
  const { copy } = useCommunityOutlet();
  const [page, setPage] = useState(1);

  const revisionsQ = useQuery({
    queryKey: ['discussion-revisions', topicId, page],
    queryFn: () => listDiscussionRevisions(topicId, { page, pageSize: PAGE_SIZE }),
    enabled: Number.isFinite(topicId) && topicId > 0,
    staleTime: 30_000,
  });

  const error = revisionsQ.error;
  const forbidden = error instanceof ApiClientError && error.code === 40300;
  const total = revisionsQ.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="max-w-3xl mx-auto">
      <header className="border-t-2 border-ink pt-6 mb-6">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ community --history #{topicId}</p>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tightest text-ink leading-[1.15]">
            {copy.history_title}
          </h1>
          <Link to={`/community/${topicId}`} className="text-sm text-amber">
            {i18n.t('返回主题')}
          </Link>
        </div>
      </header>

      {revisionsQ.isLoading ? (
        <div className="py-16 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : forbidden ? (
        <p className="border border-rule bg-paper-2/40 p-6 text-sm text-ink-3">
          {copy.history_denied}
        </p>
      ) : revisionsQ.isError ? (
        <p className="py-12 text-sm text-ink-3">{copy.load_failed}</p>
      ) : total === 0 ? (
        <p className="py-12 text-sm text-ink-3">{i18n.t('该主题还没有修改记录。')}</p>
      ) : (
        <>
          {(revisionsQ.data?.items ?? []).map((rev) => (
            <article key={rev.id} className="border-b border-rule py-5">
              <div className="flex flex-wrap items-center gap-2 font-mono text-2xs text-ink-3">
                <span className="text-ink">{i18n.t('版本 {{v0}}', { v0: rev.revision })}</span>
                <span aria-hidden>·</span>
                <span>{relativeTime(rev.createdAt)}</span>
                <span aria-hidden>·</span>
                <span>{i18n.t('由 {{v0}} 修改', { v0: rev.actor?.username ?? `#${rev.actorId ?? 0}` })}</span>
              </div>
              {rev.title && (
                <h2 className="mt-2 text-sm font-medium text-ink break-words">{rev.title}</h2>
              )}
              <div className="mt-2">
                <Markdown>{rev.contentMd}</Markdown>
              </div>
            </article>
          ))}
          {totalPages > 1 && (
            <nav className="flex items-center justify-between py-5 font-mono text-2xs text-ink-3">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {i18n.t('← 上一页')}
              </button>
              <span className="tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 border border-rule rounded-sm hover:border-rule-strong disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {i18n.t('下一页 →')}
              </button>
            </nav>
          )}
        </>
      )}
    </div>
  );
}
