import i18n from '@/locales/i18n';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { Badge, Button, Spinner, useToast } from '@/components/ui';
import { listMyInstances, stopInstance } from '@/api/instance';
import { ApiClientError } from '@/api/client';
import { formatTime, relativeTime } from '@/lib/utils';
import type { InstanceStatus } from '@/types';
import { useAuthStore } from '@/stores/auth';

const STATUS_TONE: Record<InstanceStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  running: 'success',
  stopped: 'neutral',
  expired: 'neutral',
  auto_expired: 'warning',
  error: 'danger',
};

const STATUS_LABEL: Record<InstanceStatus, string> = {
  running: i18n.t('运行中'),
  stopped: i18n.t('已停止'),
  expired: i18n.t('已过期'),
  auto_expired: i18n.t('自动回收'),
  error: i18n.t('错误'),
};

/**
 * My instances — a dense ruled list, not a card with a header slab.
 * Each row reads like a `docker ps` line:
 *   title   status   host:port   started   expires   [destroy]
 */
export function MyInstancesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const me = useAuthStore((s) => s.user);
  const list = useQuery({ queryKey: ['my-instances'], queryFn: listMyInstances });

  const stopMut = useMutation({
    mutationFn: (inst: { challengeId: number; id: number }) =>
      stopInstance(inst.challengeId, inst.id),
    onSuccess: () => {
      toast.success(i18n.t('已销毁'));
      qc.invalidateQueries({ queryKey: ['my-instances'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : i18n.t('操作失败')),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <header className="border-t-2 border-ink pt-6 mb-8">
        <p className="font-mono text-2xs text-ink-3 mb-3">$ docker ps --user=self</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tightest text-ink leading-[1.1]">
          {i18n.t('我的实例')}
        </h1>
        <p className="mt-2 text-ink-2 max-w-prose">
          {i18n.t('你与队友共享的容器实例 —— 包括运行中、已过期、自动回收。')}
        </p>
      </header>

      {list.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="h-5 w-5 text-ink-3" />
        </div>
      ) : list.data?.length ? (
        <div className="border-t border-rule">
          <div className="hidden md:grid grid-cols-[1fr_8rem_12rem_5rem] gap-x-4 py-2 border-b border-rule-strong font-mono text-2xs text-ink-3">
            <span>challenge</span>
            <span>status</span>
            <span>endpoint</span>
            <span></span>
          </div>
          <ul>
            {list.data.map((inst) => (
              <li
                key={inst.id}
                className="grid grid-cols-[1fr_auto] md:grid-cols-[1fr_8rem_12rem_5rem] gap-x-4 items-center py-3 border-b border-rule"
              >
                <div className="min-w-0">
                  <Link
                    to={`/challenges/${inst.challengeId}`}
                    className="font-medium truncate hover:text-amber transition-colors hover:no-underline"
                  >
                    {inst.challenge?.title ?? i18n.t('题目 #{{v0}}', { v0: inst.challengeId })}
                  </Link>
                  <div className="font-mono text-2xs text-ink-3 mt-1 tabular-nums">
                    {inst.teamId && inst.userId !== me?.id && (
                      <span className="text-amber">
                        {i18n.t('团队 · {{v0}} ·', { v0: inst.user?.username ?? i18n.t('队友') })}{' '}
                      </span>
                    )}
                    {i18n.t('启动 {{v0}}', { v0: relativeTime(inst.startedAt) })}
                    {inst.status === 'running' && <> · {i18n.t('到期 {{v0}}', { v0: formatTime(inst.expiresAt) })}</>}
                  </div>
                </div>
                <div>
                  <Badge tone={STATUS_TONE[inst.status]}>
                    {STATUS_LABEL[inst.status]}
                  </Badge>
                </div>
                <div className="hidden md:block font-mono text-2xs text-ink-2 truncate tabular-nums">
                  {inst.host}:{inst.port}
                </div>
                <div className="hidden md:flex justify-end">
                  {inst.status === 'running' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        stopMut.mutate({ challengeId: inst.challengeId, id: inst.id })
                      }
                      aria-label={i18n.t('销毁实例')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                {inst.status === 'running' && (
                  <div className="md:hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        stopMut.mutate({ challengeId: inst.challengeId, id: inst.id })
                      }
                      aria-label={i18n.t('销毁实例')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="border-t border-rule py-16 text-center text-sm text-ink-3">{i18n.t('还没有实例。{{v0}}', { v0: ' ' })}<Link to="/challenges" className="text-amber">
            {i18n.t('去浏览题目')}
          </Link>
        </div>
      )}
    </div>
  );
}
