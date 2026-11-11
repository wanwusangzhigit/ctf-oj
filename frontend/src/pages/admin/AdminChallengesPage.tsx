import i18n from '@/locales/i18n';
import { useDeferredValue, useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Input, Spinner, useConfirm, useToast } from '@/components/ui';
import { deleteChallenge, listChallenges } from '@/api/challenge';
import { ApiClientError } from '@/api/client';
import type { ChallengeStatus } from '@/types';
import { useAuthStore } from '@/stores/auth';
import { hasPermission } from '@/lib/permissions';

const STATUS_LABEL: Record<ChallengeStatus, string> = {
  draft: i18n.t('草稿'),
  hidden: i18n.t('隐藏'),
  published: i18n.t('已发布'),
  archived: i18n.t('已归档'),
};

/**
 * Admin challenge list. Pure listing — no inline edit form.
 *
 * Clicking Edit navigates to /admin/challenges/:id/edit.
 * The New Challenge button navigates to /admin/challenges/new.
 *
 * Reads like the user-facing ChallengesPage: ruled list, mono IDs, status
 * badges for publish state and container flag.
 */
const PAGE_SIZE = 50;

export function AdminChallengesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canManageAll = hasPermission(user, 'challenge.manage');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<ChallengeStatus | ''>('');
  const [page, setPage] = useState(1);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    setPage(1);
  }, [deferredQuery, status]);

  const list = useQuery({
    queryKey: ['admin-challenges', deferredQuery, status, page],
    queryFn: () =>
      listChallenges({
        scope: 'admin',
        page,
        pageSize: PAGE_SIZE,
        q: deferredQuery.trim() || undefined,
        status: status || undefined,
      }),
  });
  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const deleteMut = useMutation({
    mutationFn: (id: number) => deleteChallenge(id),
    onSuccess: () => {
      toast.success(i18n.t('题目已删除'));
      qc.invalidateQueries({ queryKey: ['admin-challenges'] });
      qc.invalidateQueries({ queryKey: ['challenges'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiClientError ? err.message : i18n.t('删除失败'));
    },
  });

  return (
    <div>
      <header className="flex items-end justify-between gap-4 flex-wrap mb-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-ink">{i18n.t('题目（{{v0}}）', { v0: total })}</h2>
          <p className="text-sm text-ink-3 mt-1">
            {canManageAll
              ? i18n.t('新建、编辑、删除题目与容器源。')
              : i18n.t('你被授予了这些题目的修改权限。删除与授权管理仅限全局题目管理员。')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={i18n.t('搜索标题 / 标签')}
            className="w-56"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ChallengeStatus | '')}
            className="h-9 px-2 bg-paper border border-rule rounded-sm text-sm"
          >
            <option value="">{i18n.t('全部状态')}</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {canManageAll && (
            <Button onClick={() => navigate('/admin/challenges/new')}>
              <Plus className="h-3.5 w-3.5" />
              {i18n.t('新建题目')}
            </Button>
          )}
        </div>
      </header>

      {list.isLoading ? (
        <div className="border-t border-rule py-12 flex justify-center">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : (list.data?.items?.length ?? 0) > 0 ? (
        <div className="border-t border-rule">
          <div className="hidden md:grid grid-cols-[3.5rem_1fr_8rem_8rem_5rem] gap-x-4 py-2 border-b border-rule-strong font-mono text-2xs text-ink-3">
            <span>id</span>
            <span>title</span>
            <span>category</span>
            <span>state</span>
            <span />
          </div>
          <ul>
            {(list.data?.items ?? []).map((c) => (
              <li
                key={c.id}
                className="grid grid-cols-[3.5rem_1fr_auto] md:grid-cols-[3.5rem_1fr_8rem_8rem_5rem] gap-x-4 items-center py-3 border-b border-rule hover:bg-paper-2 transition-colors"
              >
                <span className="font-mono text-2xs text-ink-3 tabular-nums">
                  {String(c.id).padStart(3, '0')}
                </span>
                <div className="min-w-0">
                  <Link
                    to={`/admin/challenges/${c.id}/edit`}
                    className="font-medium truncate hover:text-amber transition-colors hover:no-underline"
                  >
                    {c.title}
                  </Link>
                  <div className="md:hidden mt-1 flex items-center gap-3 text-2xs font-mono text-ink-3 tabular-nums">
                    <span>{c.category?.name ?? '—'}</span>
                    <span>{STATUS_LABEL[c.status] ?? i18n.t('草稿')}</span>
                  </div>
                </div>
                <span className="hidden md:block font-mono text-sm text-ink-2 truncate">
                  {c.category?.name ?? '—'}
                </span>
                <div className="hidden md:flex items-center gap-1.5">
                  <Badge tone={c.status === 'published' ? 'success' : undefined}>
                    {STATUS_LABEL[c.status] ?? i18n.t('草稿')}
                  </Badge>
                  {c.isDynamic && <Badge tone="accent">{i18n.t('容器')}</Badge>}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(`/admin/challenges/${c.id}/edit`)}
                    aria-label={i18n.t('编辑')}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {canManageAll && (
                    <Button
                      variant="ghost"
                      size="icon"
                      loading={deleteMut.isPending && deleteMut.variables === c.id}
                      onClick={async () => {
                        const ok = await confirm({
                          title: i18n.t('删除题目'),
                          description: i18n.t('删除题目「{{v0}}」？相关的提交、解题、提示、附件与讨论记录都会被一并删除，无法恢复。', { v0: c.title }),
                          confirmText: i18n.t('删除题目'),
                        });
                        if (ok) deleteMut.mutate(c.id);
                      }}
                      aria-label={i18n.t('删除')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-t border-rule py-16 text-center">
          <p className="text-sm text-ink-3 mb-4">
            {deferredQuery || status ? i18n.t('没有匹配的题目。') : i18n.t('暂无题目。')}
          </p>
          {canManageAll && !deferredQuery && !status && (
            <Button onClick={() => navigate('/admin/challenges/new')}>
              <Plus className="h-3.5 w-3.5" />
              {i18n.t('创建第一道题')}
            </Button>
          )}
        </div>
      )}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between border-t border-rule py-4 text-2xs text-muted">
          <span>{i18n.t('第 {{v0}} / {{v1}} 页 · 共 {{v2}} 道题', { v0: page, v1: totalPages, v2: total })}</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || list.isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              {i18n.t('上一页')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || list.isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {i18n.t('下一页')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
