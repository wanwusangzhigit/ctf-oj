import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@/components/ui';
import { listCompetitionAnnouncements } from '@/api/competition';
import { Markdown } from '@/components/Markdown';
import { formatTime } from '@/lib/utils';
import { useCompetitionOutlet } from './CompetitionLayout';

export function CompetitionAnnouncementsPage() {
  const { competition: c } = useCompetitionOutlet();
  const announcements = useQuery({
    queryKey: ['competition-announcements', c.id],
    queryFn: () => listCompetitionAnnouncements(c.id, 1, 20),
    staleTime: 30_000,
  });

  return (
    <section>
      <div className="border-b border-rule pb-2 mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">比赛公告</h2>
        <span className="font-mono text-2xs text-ink-3 tabular-nums">
          {announcements.data?.total ?? 0} 条
        </span>
      </div>
      {announcements.isLoading ? (
        <Spinner className="h-4 w-4 text-ink-3" />
      ) : announcements.isError ? (
        <p className="text-sm text-ink-3">无法加载比赛公告。</p>
      ) : (announcements.data?.items.length ?? 0) === 0 ? (
        <p className="text-sm text-ink-3">暂无比赛公告。</p>
      ) : (
        <div className="space-y-5">
          {announcements.data!.items.map((a) => (
            <article key={a.id} className="border-l-2 border-rule-strong pl-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-ink">{a.title}</h3>
                <time className="font-mono text-2xs text-ink-3 whitespace-nowrap">
                  {formatTime(a.createdAt)}
                </time>
              </div>
              {a.contentMd && (
                <div className="mt-2 max-w-prose">
                  <Markdown>{a.contentMd}</Markdown>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
