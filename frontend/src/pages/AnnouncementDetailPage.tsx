import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getAnnouncement } from '@/api/announcement';
import { Badge, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { formatTime } from '@/lib/utils';

/**
 * Single announcement — presented like an essay in a notebook:
 * small mono date above, large title, then prose in a comfortable measure.
 */
export function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const aid = Number(id);
  const { data, isLoading, error } = useQuery({
    queryKey: ['announcement', aid],
    queryFn: () => getAnnouncement(aid),
    enabled: !Number.isNaN(aid),
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            公告不存在
          </h1>
          <p className="mt-2 text-ink-3">它可能被删除或撤销了。</p>
          <div className="mt-4">
            <Link
              to="/announcements"
              className="inline-flex items-center gap-1 text-amber font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              返回公告列表
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to="/announcements"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors mb-8 hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回公告
      </Link>

      <header className="border-t-2 border-ink pt-6 mb-8">
        <div className="font-mono text-2xs text-ink-3 mb-3 flex items-center gap-3 tabular-nums">
          <span>
            {formatTime(data.publishedAt ?? data.createdAt)}
          </span>
          {data.isPinned && <Badge tone="accent">pinned</Badge>}
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {data.title}
        </h1>
      </header>

      <div className="max-w-prose text-ink-2 leading-relaxed">
        <Markdown>{data.contentMd || '（无内容）'}</Markdown>
      </div>
    </article>
  );
}
