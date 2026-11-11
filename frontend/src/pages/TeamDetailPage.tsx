import i18n from '@/locales/i18n';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Crown, Trophy, Users } from 'lucide-react';
import { Badge, Spinner } from '@/components/ui';
import { Avatar } from '@/components/layout/Avatar';
import { getTeam, teamScoreboard } from '@/api/team';
import { formatNumber, relativeTime } from '@/lib/utils';
import { DiscussionPanel } from '@/components/DiscussionPanel';
import { useAuthStore } from '@/stores/auth';

/** Public team profile — name, score and roster. */
export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tid = Number(id);
  const user = useAuthStore((s) => s.user);

  const q = useQuery({
    queryKey: ['team', tid],
    queryFn: () => getTeam(tid),
    enabled: Number.isFinite(tid) && tid > 0,
  });

  if (q.isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (q.isError || !q.data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16">
        <div className="border-t-2 border-ink pt-6">
          <h1 className="text-2xl font-semibold tracking-tight">{i18n.t('团队不存在')}</h1>
          <p className="mt-2 text-ink-3">{i18n.t('该团队可能已解散。')}</p>
          <Link
            to="/teams"
            className="mt-4 inline-flex items-center gap-1 text-amber font-medium"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {i18n.t('返回团队')}
          </Link>
        </div>
      </div>
    );
  }

  const t = q.data;
  const isMember = !!user && (t.members ?? []).some((m) => m.userId === user.id);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to="/teams/scoreboard"
        className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors mb-6 hover:no-underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {i18n.t('团队榜')}
      </Link>

      <header className="border-t-2 border-ink pt-6 mb-8">
        <div className="font-mono text-2xs text-ink-3 mb-2">@{t.slug}</div>
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <h1 className="text-3xl font-semibold tracking-tightest text-ink leading-[1.1]">
            {t.name}
          </h1>
          <div className="text-right">
            <div className="font-mono text-2xs text-ink-3">{i18n.t('团队总分')}</div>
            <div className="font-mono text-3xl font-semibold tabular-nums text-ink">
              {formatNumber(t.score)}
            </div>
          </div>
        </div>
        <p className="mt-3 font-mono text-2xs text-ink-3">{i18n.t('创建于 {{v0}}', { v0: relativeTime(t.createdAt) })}</p>
        {t.description && (
          <p className="mt-3 text-sm text-ink-2 max-w-prose">{t.description}</p>
        )}
      </header>

      <section>
        <div className="flex items-center gap-2 border-b border-rule pb-2 mb-3">
          <Users className="h-3.5 w-3.5 text-ink-3" />
          <h2 className="text-sm font-medium text-ink">{i18n.t('成员（{{v0}}）', { v0: t.members?.length ?? 0 })}</h2>
        </div>
        {(t.members?.length ?? 0) === 0 ? (
          <p className="text-sm text-ink-3">{i18n.t('暂无成员。')}</p>
        ) : (
          <ul className="border-t border-rule">
            {(t.members ?? []).map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 py-2.5 border-b border-rule"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={m.user?.username ?? '?'} />
                  <Link
                    to={`/users/${m.userId}`}
                    className="font-medium text-sm truncate hover:text-amber"
                  >
                    {m.user?.username ?? `#${m.userId}`}
                  </Link>
                  {m.userId === t.ownerId && (
                    <Badge tone="warning">
                      <Crown className="h-3 w-3" />
                      {i18n.t('队长')}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono text-2xs text-ink-3 tabular-nums">{i18n.t('{{v0}} 分', { v0: formatNumber(m.user?.score ?? 0) })}</span>
                  <span className="font-mono text-2xs text-ink-3 tabular-nums hidden sm:inline">
                    {relativeTime(m.joinedAt)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        {isMember ? (
          <DiscussionPanel
            target={{ scope: 'team', id: t.id }}
            title={i18n.t('团队讨论')}
            canPost
            canModerate={user?.id === t.ownerId}
            emptyText={i18n.t('还没有团队讨论。发布第一条内部消息吧。')}
          />
        ) : (
          <div className="border-t border-rule pt-4">
            <h2 className="text-sm font-medium text-ink">{i18n.t('团队讨论')}</h2>
            <p className="mt-1 text-sm text-ink-3">{i18n.t('仅团队成员可见。')}</p>
          </div>
        )}
      </section>
    </div>
  );
}

export function TeamScoreboardPage() {
  const q = useQuery({
    queryKey: ['team-scoreboard'],
    queryFn: () => teamScoreboard(1, 100),
    staleTime: 30_000,
  });

  const items = q.data?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ teams --ranked</p>
        <h1 className="text-3xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {i18n.t('团队榜')}
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          {i18n.t('按团队成员解题总分排名。')}
        </p>
      </header>

      {q.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : q.isError ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          {i18n.t('无法加载团队榜。')}
        </div>
      ) : items.length === 0 ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          {i18n.t('还没有团队。')}
        </div>
      ) : (
        <ol className="border-t border-ink">
          {items.map((t, idx) => (
            <li key={t.id}>
              <Link
                to={`/teams/${t.id}`}
                className="group grid grid-cols-[2.5rem_1fr_auto] gap-x-3 items-center py-3 border-b border-rule hover:bg-paper-2 transition-colors hover:no-underline px-1"
              >
                <span className="font-mono text-sm text-ink-3 tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Trophy
                      className={`h-3 w-3 shrink-0 ${
                        idx === 0 ? 'text-amber' : 'text-ink-3'
                      }`}
                    />
                    <span className="font-medium text-ink truncate group-hover:text-amber transition-colors">
                      {t.name}
                    </span>
                  </div>
                  <div className="font-mono text-2xs text-ink-3 mt-0.5">
                    @{t.slug}
                  </div>
                </div>
                <span className="font-mono text-sm tabular-nums text-ink">
                  {formatNumber(t.score)}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
