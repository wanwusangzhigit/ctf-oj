import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Spinner,
  useToast,
} from '@/components/ui';
import { listMyInstances, stopInstance } from '@/api/instance';
import { ApiClientError } from '@/api/client';
import { formatTime, relativeTime } from '@/lib/utils';
import type { InstanceStatus } from '@/types';

const STATUS_TONE: Record<InstanceStatus, 'success' | 'neutral' | 'warning' | 'danger'> = {
  running: 'success',
  stopped: 'neutral',
  expired: 'neutral',
  error: 'danger',
};

export function MyInstancesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const list = useQuery({ queryKey: ['my-instances'], queryFn: listMyInstances });

  const stopMut = useMutation({
    mutationFn: (inst: { challengeId: number; id: number }) =>
      stopInstance(inst.challengeId, inst.id),
    onSuccess: () => {
      toast.success('已销毁');
      qc.invalidateQueries({ queryKey: ['my-instances'] });
    },
    onError: (err) => toast.error(err instanceof ApiClientError ? err.message : '操作失败'),
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">我的实例</h1>
        <p className="text-sm text-muted mt-1">你启动过的全部容器实例。</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>当前实例（{list.data?.length ?? 0}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {list.isLoading ? (
            <div className="py-12 flex items-center justify-center">
              <Spinner className="h-5 w-5 text-muted" />
            </div>
          ) : list.data?.length ? (
            <ul className="divide-y divide-border">
              {list.data.map((inst) => (
                <li key={inst.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/challenges/${inst.challengeId}`}
                        className="font-medium truncate hover:text-accent"
                      >
                        {inst.challenge?.title ?? `题目 #${inst.challengeId}`}
                      </Link>
                      <Badge tone={STATUS_TONE[inst.status]}>{inst.status}</Badge>
                    </div>
                    <div className="text-2xs text-muted mt-0.5 font-mono">
                      {inst.host}:{inst.port} · 启动 {relativeTime(inst.startedAt)}
                      {inst.status === 'running' && <> · 到期 {formatTime(inst.expiresAt)}</>}
                    </div>
                  </div>
                  {inst.status === 'running' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        stopMut.mutate({ challengeId: inst.challengeId, id: inst.id })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-12 text-center text-sm text-muted">
              还没有实例。
              <Link to="/challenges" className="text-accent ml-1">
                去浏览题目
              </Link>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
