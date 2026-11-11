import i18n from '@/locales/i18n';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { listAnnouncements } from '@/api/announcement';
import { Badge, Spinner } from '@/components/ui';
import { Markdown } from '@/components/Markdown';
import { formatTime, relativeTime } from '@/lib/utils';
import type { Announcement } from '@/types';

/**
 * Announcements — a column of ruled entries rather than stacked cards.
 * The pinned item gets a small amber marker; everything else is left-aligned
 * prose with a mono date column.
 */
export function AnnouncementsPage() {
  const [page] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ['announcements', page],
    queryFn: () => listAnnouncements(page, 30),
    staleTime: 60_000,
  });

  const pinned = data?.items?.find((a) => a.isPinned);
  const rest = data?.items?.filter((a) => !a.isPinned) ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ cat /news</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {i18n.t('公告')}
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          {i18n.t('来自管理员的站点动态 —— 比赛、维护、变更。')}
        </p>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : (pinned || rest.length > 0) ? (
        <div className="space-y-12">
          {pinned && <PinnedAnnouncement a={pinned} />}
          {rest.length > 0 && (
            <section>
              <SectionLabel>{i18n.t('历史')}</SectionLabel>
              <ul className="border-t border-rule">
                {rest.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/announcements/${a.id}`}
                      className="grid grid-cols-[5.5rem_1fr] gap-x-4 items-baseline py-3 border-b border-rule hover:bg-paper-2 transition-colors hover:no-underline"
                    >
                      <span className="font-mono text-2xs text-ink-3 tabular-nums">
                        {formatTime(a.publishedAt ?? a.createdAt).slice(0, 10)}
                      </span>
                      <span className="text-sm font-medium text-ink truncate">
                        {a.title}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <div className="border-t border-rule py-16 text-center text-sm text-ink-3">
          {i18n.t('暂无公告。')}
        </div>
      )}
    </div>
  );
}

function PinnedAnnouncement({ a }: { a: Announcement }) {
  return (
    <article>
      <SectionLabel>{i18n.t('置顶')}</SectionLabel>
      <Link
        to={`/announcements/${a.id}`}
        className="block hover:no-underline"
      >
        <div className="flex items-center gap-2 mb-2">
          <Badge tone="accent">pinned</Badge>
          <span className="font-mono text-2xs text-ink-3 tabular-nums">
            {formatTime(a.publishedAt ?? a.createdAt)}
          </span>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink mb-3">
          {a.title}
        </h2>
      </Link>
      <div className="max-w-prose text-ink-2">
        <Markdown>{a.contentMd || i18n.t('（无内容）')}</Markdown>
      </div>
      <div className="mt-4">
        <Link
          to={`/announcements/${a.id}`}
          className="font-mono text-2xs text-amber"
        >{i18n.t('查看全文 · {{v0}}', { v0: relativeTime(a.publishedAt ?? a.createdAt) })}</Link>
      </div>
    </article>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-b border-rule pb-2 mb-4">
      <h2 className="text-sm font-medium text-ink">{children}</h2>
    </div>
  );
}

// Note: AnnouncementDetailPage is intentionally exported from its own file;
// we keep the legacy export below for backwards compatibility with older
// route configs that imported it from here.
export function AnnouncementDetailPage() {
  return null;
}

export const _relative = relativeTime;
