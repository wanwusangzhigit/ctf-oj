import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Star, Pencil, Trash2, Megaphone, Users } from 'lucide-react';
import { Badge, Button, Spinner, useConfirm, useToast } from '@/components/ui';
import { deleteCompetition, exportCompetitionScores } from '@/api/competition';
import { ApiClientError } from '@/api/client';
import { formatTime } from '@/lib/utils';
import { useAdminCompetitions } from '@/hooks/useAdminCompetitions';
import { CHALLENGE_STATUS } from '@/components/admin/CompetitionForm';
import type { Competition } from '@/types';
import { useAuthStore } from '@/stores/auth';
import { hasPermission } from '@/lib/permissions';

const ICON_LINK_CLS =
  'inline-flex h-7 w-7 items-center justify-center rounded-sm text-ink transition-colors hover:bg-paper-2 hover:text-amber hover:no-underline';

/**
 * AdminCompetitionsPage — competition directory.
 * Only one competition may be active at a time — the server enforces the
 * singleton, the form only exposes the switch to global managers.
 *
 * Every write lives on its own route: /admin/competitions/new,
 * /admin/competitions/:id/edit, /:id/announcements, /:id/registrations.
 */
export function AdminCompetitionsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canManageAll = hasPermission(user, 'competition.manage');

  const listQ = useAdminCompetitions();

  const exportMut = useMutation({
    mutationFn: (c: Competition) => exportCompetitionScores(c.id, 'user', c.slug),
    onSuccess: () => toast.success('成绩已导出'),
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '导出失败'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteCompetition(id),
    onSuccess: () => {
      toast.success('已删除');
      qc.invalidateQueries({ queryKey: ['admin-competitions'] });
    },
    onError: (err) =>
      toast.error(err instanceof ApiClientError ? err.message : '删除失败'),
  });

  return (
    <div className="space-y-6">
      <header className="border-t-2 border-ink pt-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-2xs text-ink-3 mb-3">
            $ sudo admin --competitions
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-ink">
            赛事
          </h2>
          <p className="mt-1 text-sm text-ink-3 max-w-prose">
            {canManageAll
              ? '比赛窗口、记分板冻结窗口的元数据。同时只有一个赛事处于激活状态。'
              : '你被授予了这些赛事的修改权限，可编辑赛事元数据。'}
          </p>
        </div>
        {canManageAll && (
          <Button
            variant="primary"
            className="shrink-0 whitespace-nowrap"
            onClick={() => navigate('/admin/competitions/new')}
          >
            <Plus className="h-3.5 w-3.5" /> 新建赛事
          </Button>
        )}
      </header>

      {listQ.isLoading ? (
        <div className="py-10 flex items-center justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : listQ.isError ? (
        <div className="py-10 text-center text-sm text-ink-3">
          无法加载赛事列表。
        </div>
      ) : (listQ.data?.items?.length ?? 0) === 0 ? (
        <div className="border-t border-rule py-10 text-center text-sm text-ink-3">
          {canManageAll ? '尚未创建任何赛事。' : '没有可管理的赛事。'}
        </div>
      ) : (
        <ul className="border-t border-ink">
          {listQ.data!.items.map((c) => (
            <li
              key={c.id}
              className="grid grid-cols-[1fr_auto] gap-4 py-4 border-b border-rule"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-ink">{c.name}</h3>
                  {c.isActive && (
                    <Badge tone="accent">
                      <Star className="h-3 w-3" />
                      当前赛事
                    </Badge>
                  )}
                  {c.registrationRequired && <Badge tone="warning">需报名</Badge>}
                </div>
                <div className="font-mono text-2xs text-ink-3 mt-0.5 tabular-nums">
                  {c.startAt ? formatTime(c.startAt) : '—'} →{' '}
                  {c.endAt ? formatTime(c.endAt) : '—'}
                  {c.freezeAt && ` · freeze ${formatTime(c.freezeAt)}`}
                </div>
                {c.description && (
                  <p className="text-sm text-ink-2 mt-2 max-w-prose line-clamp-2">
                    {c.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-ink-3">
                  <span className="font-mono">{c.challenges?.length ?? 0} 道题</span>
                  {(c.challenges?.filter((ch) => ch.status === 'hidden').length ?? 0) >
                    0 && (
                    <Badge tone="warning">
                      {c.challenges!.filter((ch) => ch.status === 'hidden').length} 隐藏
                    </Badge>
                  )}
                </div>
                {c.challenges && c.challenges.length > 0 ? (
                  <details className="mt-1 text-2xs text-ink-3">
                    <summary className="cursor-pointer select-none hover:text-ink">
                      查看题目列表
                    </summary>
                    <ul className="mt-1.5 space-y-1 border-l border-rule pl-3">
                      {c.challenges.map((ch) => (
                        <li key={ch.id} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-ink-2">
                            {ch.title}
                          </span>
                          <span className="font-mono tabular-nums">
                            {CHALLENGE_STATUS[ch.status]}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <p className="mt-1 text-2xs text-ink-3">
                    未绑定题目，计分覆盖全部公开题目。
                  </p>
                )}
              </div>
              <div className="flex items-start gap-1">
                {canManageAll && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={exportMut.isPending && exportMut.variables?.id === c.id}
                    onClick={() => exportMut.mutate(c)}
                    aria-label="导出成绩"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Link
                  to={`/admin/competitions/${c.id}/announcements`}
                  className={ICON_LINK_CLS}
                  aria-label="比赛公告"
                >
                  <Megaphone className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to={`/admin/competitions/${c.id}/registrations`}
                  className={ICON_LINK_CLS}
                  aria-label="报名与成绩"
                >
                  <Users className="h-3.5 w-3.5" />
                </Link>
                <Link
                  to={`/admin/competitions/${c.id}/edit`}
                  className={ICON_LINK_CLS}
                  aria-label="编辑"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Link>
                {canManageAll && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={deleteMut.isPending}
                    onClick={async () => {
                      const ok = await confirm({
                        title: '删除赛事',
                        description: `删除赛事「${c.name}」？报名记录、赛事题目关联与成绩一并移除，无法恢复。`,
                        confirmText: '删除赛事',
                      });
                      if (ok) deleteMut.mutate(c.id);
                    }}
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
