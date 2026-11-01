import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui';
import { useAdminCompetition } from '@/hooks/useAdminCompetitions';
import type { Competition } from '@/types';

/**
 * Shell for `/admin/competitions/:id/*`.
 *
 * Resolves the row from the shared admin list query rather than the detail
 * endpoint: a delegated manager may only fetch `scope=admin` detail for their
 * own competitions, and the list already carries every field these views need.
 */
export function CompetitionAdminShell({
  competitionId,
  command,
  title,
  note,
  children,
}: {
  competitionId: number;
  command: string;
  title: string;
  note?: string;
  children: (competition: Competition) => ReactNode;
}) {
  const { query, competition } = useAdminCompetition(competitionId);

  const back = (
    <Link
      to="/admin/competitions"
      className="inline-flex items-center gap-1 text-sm text-ink-3 hover:text-ink transition-colors hover:no-underline"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      返回赛事列表
    </Link>
  );

  if (!Number.isFinite(competitionId) || competitionId <= 0) {
    return (
      <div className="space-y-4">
        {back}
        <div className="border-t border-rule pt-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            赛事 ID 无效
          </h2>
          <p className="text-sm text-ink-3 mt-2">URL 中的 id 参数不是合法的数字。</p>
        </div>
      </div>
    );
  }

  if (query.isLoading) {
    return (
      <div className="py-16 flex items-center justify-center">
        <Spinner className="h-5 w-5 text-ink-3" />
      </div>
    );
  }

  if (query.isError || !competition) {
    return (
      <div className="space-y-4">
        {back}
        <div className="border-t border-rule pt-6">
          <h2 className="text-lg font-semibold tracking-tight text-ink">
            无法打开该赛事
          </h2>
          <p className="text-sm text-ink-3 mt-2">
            {query.isError
              ? '赛事列表加载失败，请稍后重试。'
              : '赛事不存在，或你没有该赛事的管理权限。'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <header className="border-b border-rule pb-3">
        <p className="font-mono text-2xs text-ink-3 mb-1 tabular-nums">
          $ sudo admin --competitions {command}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">{title}</h2>
        <p className="mt-1 text-sm text-ink-3 max-w-prose">
          <span className="font-mono text-2xs">{competition.name}</span>
          {note && ` · ${note}`}
        </p>
      </header>
      {children(competition)}
    </div>
  );
}
